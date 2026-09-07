package com.plugin.config;

import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.dao.DataAccessException;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Collation;

import java.time.LocalTime;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Configuration
@Slf4j
public class MongoConfig {

    @Bean
    public MongoTransactionManager transactionManager(MongoDatabaseFactory databaseFactory) {
        return new MongoTransactionManager(databaseFactory);
    }

    @Bean
    public MongoCustomConversions mongoCustomConversions() {
        return new MongoCustomConversions(List.of(
                new IntegerToBooleanConverter(),
                new LongToBooleanConverter(),
                new IntegerToLocalTimeConverter(),
                new LongToLocalTimeConverter()
        ));
    }

    @Bean
    public ApplicationRunner bookingIndexes(MongoTemplate mongoTemplate) {
        return args -> {
            try {
                var indexes = mongoTemplate.indexOps("bookings");
                indexes.ensureIndex(new Index().on("createdAt", org.springframework.data.domain.Sort.Direction.DESC)
                        .named("idx_booking_created_desc"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("status", 1)
                        .append("createdAt", -1))
                        .named("idx_booking_status_created_desc"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("customerId", 1)
                        .append("createdAt", -1))
                        .named("idx_booking_customer_created_desc"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("stationId", 1)
                        .append("createdAt", -1))
                        .named("idx_booking_station_created_desc"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("chargingPointId", 1)
                        .append("startTime", 1)
                        .append("endTime", 1))
                        .named("idx_booking_point_id_time"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("customerId", 1).append("requestKey", 1))
                        .named("idx_booking_customer_request"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("chargingPointId", 1).append("status", 1)
                        .append("startTime", 1).append("reservedUntil", 1))
                        .named("idx_booking_reserved_window"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("chargingPoint.id", 1)
                        .append("startTime", 1)
                        .append("endTime", 1))
                        .named("idx_booking_point_time"));
            } catch (DataAccessException ex) {
                log.warn("Skipping MongoDB booking index initialization because MongoDB is unavailable; type={}",
                        ex.getClass().getName());
            }
        };
    }

    @Bean
    public ApplicationRunner otpIndexes(MongoTemplate mongoTemplate) {
        return args -> {
            try {
                mongoTemplate.indexOps("passwordResetOtps").ensureIndex(
                        new Index()
                                .on("expiresAt", org.springframework.data.domain.Sort.Direction.ASC)
                                .expire(Duration.ZERO)
                                .named("ttl_password_reset_otp_expiry")
                );
                mongoTemplate.indexOps("passwordResetOtps").ensureIndex(
                        new CompoundIndexDefinition(new Document()
                                .append("email", 1)
                                .append("purpose", 1)
                                .append("createdAt", -1))
                                .named("idx_password_reset_otp_lookup")
                );
                mongoTemplate.indexOps("pendingRegistrations").ensureIndex(
                        new Index()
                                .on("expiresAt", org.springframework.data.domain.Sort.Direction.ASC)
                                .expire(Duration.ZERO)
                                .named("ttl_pending_registration_expiry")
                );
            } catch (DataAccessException ex) {
                log.warn("Skipping OTP index initialization because MongoDB is unavailable");
            }
        };
    }

    @Bean
    public ApplicationRunner securityRateLimitIndexes(MongoTemplate mongoTemplate) {
        return args -> {
            try {
                mongoTemplate.indexOps("securityRateLimitBuckets").ensureIndex(
                        new Index()
                                .on("expiresAt", org.springframework.data.domain.Sort.Direction.ASC)
                                .expire(Duration.ZERO)
                                .named("ttl_security_rate_limit_bucket")
                );
            } catch (DataAccessException ex) {
                log.warn("Skipping security rate-limit index initialization because MongoDB is unavailable");
            }
        };
    }

    /**
     * These indexes are correctness boundaries, not optional query tuning. A
     * production process must not serve wallet/session traffic when they cannot
     * be created (for example because legacy duplicates need reconciliation).
     */
    @Bean
    public ApplicationRunner financialIntegrityIndexes(MongoTemplate mongoTemplate) {
        return args -> {
            try {
                Collation caseInsensitiveIdentityCollation = Collation.of("en")
                        .strength(Collation.ComparisonLevel.secondary());
                mongoTemplate.indexOps("users").ensureIndex(
                        new Index().on("email", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique()
                                .collation(caseInsensitiveIdentityCollation)
                                .named("uk_users_email_case_insensitive"));
                mongoTemplate.indexOps("pendingRegistrations").ensureIndex(
                        new Index().on("email", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique()
                                .collation(caseInsensitiveIdentityCollation)
                                .named("uk_pending_registration_email_case_insensitive"));
                mongoTemplate.indexOps("wallets").ensureIndex(
                        new Index().on("customerId", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique());
                mongoTemplate.indexOps("chargingSessions").ensureIndex(
                        new Index().on("bookingId", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique().sparse());
                mongoTemplate.indexOps("chargingSessions").ensureIndex(
                        new Index().on("status", org.springframework.data.domain.Sort.Direction.ASC));
                mongoTemplate.indexOps("bills").ensureIndex(
                        new Index().on("sessionId", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique().sparse());
                mongoTemplate.indexOps("bills").ensureIndex(
                        new Index().on("invoiceNumber", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique()
                                .named("invoiceNumber"));
                mongoTemplate.indexOps("walletTopUpAttempts").ensureIndex(
                        new Index().on("razorpayOrderId", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique().sparse());
                mongoTemplate.indexOps("walletTopUpAttempts").ensureIndex(
                        new Index().on("razorpayPaymentId", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique().sparse()
                                .named("uk_wallet_top_up_payment_id"));
                mongoTemplate.indexOps("bookings").ensureIndex(
                        new Index().on("referenceId", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique()
                                .named("referenceId"));
                mongoTemplate.indexOps("chargingPoints").ensureIndex(
                        new Index().on("identifier", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique()
                                .named("identifier"));
                mongoTemplate.indexOps("stationManagerAccessInvitations").ensureIndex(
                        new Index().on("tokenHash", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique()
                                .named("tokenHash"));
                mongoTemplate.indexOps("stationManagerAccessInvitations").ensureIndex(
                        new CompoundIndexDefinition(new Document()
                                .append("applicationId", 1)
                                .append("usedAt", 1))
                                .named("idx_access_invitation_application_unused"));
                mongoTemplate.indexOps("stationManagerAccessInvitations").ensureIndex(
                        new Index().on("expiresAt", org.springframework.data.domain.Sort.Direction.ASC)
                                .expire(0, TimeUnit.SECONDS));
                mongoTemplate.indexOps("stationManagerApplications").ensureIndex(
                        new Index().on("email", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique()
                                .named("email"));
                mongoTemplate.indexOps("stationManagerApplications").ensureIndex(
                        new Index().on("applicationReferenceId", org.springframework.data.domain.Sort.Direction.ASC)
                                .unique()
                                .sparse()
                                .named("applicationReferenceId"));
                mongoTemplate.indexOps("stationManagerApplicationFiles").ensureIndex(
                        new CompoundIndexDefinition(new Document()
                                .append("applicationId", 1)
                                .append("slotType", 1)
                                .append("businessDocumentType", 1))
                                .unique()
                                .named("uk_station_manager_application_file_slot"));
            } catch (DataAccessException ex) {
                throw new IllegalStateException(
                        "Required MongoDB integrity indexes could not be established; reconcile duplicates before startup",
                        ex);
            }
        };
    }

    @ReadingConverter
    static class IntegerToBooleanConverter implements Converter<Integer, Boolean> {
        @Override
        public Boolean convert(Integer source) {
            return source != null && source != 0;
        }
    }

    @ReadingConverter
    static class LongToBooleanConverter implements Converter<Long, Boolean> {
        @Override
        public Boolean convert(Long source) {
            return source != null && source != 0L;
        }
    }

    @ReadingConverter
    static class IntegerToLocalTimeConverter implements Converter<Integer, LocalTime> {
        @Override
        public LocalTime convert(Integer source) {
            return NumericLocalTimeConverter.convert(source == null ? null : source.longValue());
        }
    }

    @ReadingConverter
    static class LongToLocalTimeConverter implements Converter<Long, LocalTime> {
        @Override
        public LocalTime convert(Long source) {
            return NumericLocalTimeConverter.convert(source);
        }
    }

    static class NumericLocalTimeConverter {
        private static final long SECONDS_PER_DAY = 24L * 60L * 60L;
        private static final long MILLIS_PER_DAY = SECONDS_PER_DAY * 1_000L;
        private static final long MICROS_PER_DAY = MILLIS_PER_DAY * 1_000L;
        private static final long NANOS_PER_DAY = MICROS_PER_DAY * 1_000L;

        private NumericLocalTimeConverter() {
        }

        static LocalTime convert(Long source) {
            if (source == null) {
                return null;
            }
            long value = Math.floorMod(source, NANOS_PER_DAY);
            if (source >= 0 && source < SECONDS_PER_DAY) {
                return LocalTime.ofSecondOfDay(source);
            }
            if (source >= 0 && source < MILLIS_PER_DAY) {
                return LocalTime.ofNanoOfDay(source * 1_000_000L);
            }
            if (source >= 0 && source < MICROS_PER_DAY) {
                return LocalTime.ofNanoOfDay(source * 1_000L);
            }
            return LocalTime.ofNanoOfDay(value);
        }
    }
}
