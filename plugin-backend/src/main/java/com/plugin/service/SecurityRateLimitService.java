package com.plugin.service;

import com.plugin.entity.SecurityRateLimitBucket;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;

@Service
@Slf4j
public class SecurityRateLimitService {

    private static final Duration BUCKET_RETENTION = Duration.ofMinutes(5);
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final MongoTemplate mongoTemplate;
    private final boolean enabled;
    private final Clock clock;
    private final SecretKeySpec bucketKey;

    @Autowired
    public SecurityRateLimitService(MongoTemplate mongoTemplate,
                                    @Value("${app.rate-limit.enabled:true}") boolean enabled,
                                    @Value("${app.rate-limit.key-pepper}") String keyPepper) {
        this(mongoTemplate, enabled, Clock.systemUTC(), keyPepper);
    }

    SecurityRateLimitService(MongoTemplate mongoTemplate, boolean enabled, Clock clock) {
        this(mongoTemplate, enabled, clock, "testOnlyRateLimitPepperThatIsAtLeastThirtyTwoBytesLong");
    }

    private SecurityRateLimitService(MongoTemplate mongoTemplate,
                                     boolean enabled,
                                     Clock clock,
                                     String keyPepper) {
        if (keyPepper == null || keyPepper.isBlank()
                || keyPepper.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("Rate-limit key pepper must contain at least 32 bytes");
        }
        this.mongoTemplate = mongoTemplate;
        this.enabled = enabled;
        this.clock = clock;
        this.bucketKey = new SecretKeySpec(
                keyPepper.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
    }

    public Decision consume(String ruleId,
                            String dimension,
                            String identifier,
                            int limit,
                            Duration window) {
        if (!enabled) {
            return Decision.allowed();
        }
        if (ruleId == null || ruleId.isBlank() || dimension == null || dimension.isBlank()
                || identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Rate-limit identity is incomplete");
        }
        if (limit < 1 || window == null || window.isZero() || window.isNegative()) {
            throw new IllegalArgumentException("Rate-limit policy is invalid");
        }

        Instant now = clock.instant();
        long windowSeconds = Math.max(1L, window.toSeconds());
        long windowStart = Math.floorDiv(now.getEpochSecond(), windowSeconds) * windowSeconds;
        Instant resetAt = Instant.ofEpochSecond(windowStart + windowSeconds);
        String bucketId = bucketId(ruleId, dimension, identifier, windowStart);

        SecurityRateLimitBucket bucket;
        try {
            try {
                bucket = increment(bucketId, resetAt, true);
            } catch (DuplicateKeyException ex) {
                // Two nodes may race while creating the same first bucket. The retry is an
                // update-only operation and remains atomic.
                bucket = increment(bucketId, resetAt, false);
            }
        } catch (RuntimeException ex) {
            log.error("Distributed rate limiter is unavailable; type={}", ex.getClass().getName());
            throw new RateLimitUnavailableException();
        }

        if (bucket == null) {
            log.error("Distributed rate limiter returned no bucket");
            throw new RateLimitUnavailableException();
        }

        long retryAfter = Math.max(1L, Duration.between(now, resetAt).toSeconds() + 1L);
        return bucket.getCount() > limit
                ? Decision.blocked(retryAfter)
                : Decision.allowed();
    }

    private SecurityRateLimitBucket increment(String bucketId, Instant resetAt, boolean upsert) {
        Query query = Query.query(Criteria.where("_id").is(bucketId));
        Update update = new Update()
                .inc("count", 1L)
                .setOnInsert("expiresAt", resetAt.plus(BUCKET_RETENTION));
        return mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().upsert(upsert).returnNew(true),
                SecurityRateLimitBucket.class
        );
    }

    private String bucketId(String ruleId, String dimension, String identifier, long windowStart) {
        String normalized = ruleId.trim().toLowerCase(Locale.ROOT)
                + "\n" + dimension.trim().toLowerCase(Locale.ROOT)
                + "\n" + identifier.trim().toLowerCase(Locale.ROOT)
                + "\n" + windowStart;
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(bucketKey);
            byte[] digest = mac.doFinal(normalized.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Rate-limit hashing is unavailable");
        }
    }

    public record Decision(boolean permitted, long retryAfterSeconds) {
        public static Decision allowed() {
            return new Decision(true, 0L);
        }

        public static Decision blocked(long retryAfterSeconds) {
            return new Decision(false, retryAfterSeconds);
        }
    }

    public static final class RateLimitUnavailableException extends RuntimeException {
        public RateLimitUnavailableException() {
            super("Rate limiter unavailable");
        }
    }
}
