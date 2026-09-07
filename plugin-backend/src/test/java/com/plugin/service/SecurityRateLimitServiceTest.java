package com.plugin.service;

import com.plugin.entity.SecurityRateLimitBucket;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SecurityRateLimitServiceTest {

    @Mock
    private MongoTemplate mongoTemplate;

    @Test
    void blocksAtomicallyIncrementedBucketOverLimit() {
        when(mongoTemplate.findAndModify(
                any(Query.class),
                any(Update.class),
                any(FindAndModifyOptions.class),
                eq(SecurityRateLimitBucket.class)))
                .thenReturn(SecurityRateLimitBucket.builder().count(4).build());
        SecurityRateLimitService service = service(true);

        SecurityRateLimitService.Decision decision = service.consume(
                "otp-send", "account", "person@example.test", 3, Duration.ofMinutes(10));

        assertThat(decision.permitted()).isFalse();
        assertThat(decision.retryAfterSeconds()).isBetween(1L, 601L);
    }

    @Test
    void disabledTestModeDoesNotTouchMongo() {
        SecurityRateLimitService.Decision decision = service(false).consume(
                "auth-login", "ip", "203.0.113.1", 1, Duration.ofMinutes(1));

        assertThat(decision.permitted()).isTrue();
        verifyNoInteractions(mongoTemplate);
    }

    @Test
    void failsClosedWhenDistributedStoreIsUnavailable() {
        when(mongoTemplate.findAndModify(
                any(Query.class),
                any(Update.class),
                any(FindAndModifyOptions.class),
                eq(SecurityRateLimitBucket.class)))
                .thenThrow(new IllegalStateException("unavailable"));

        assertThatThrownBy(() -> service(true).consume(
                "auth-login", "ip", "203.0.113.1", 1, Duration.ofMinutes(1)))
                .isInstanceOf(SecurityRateLimitService.RateLimitUnavailableException.class)
                .hasMessage("Rate limiter unavailable");
    }

    private SecurityRateLimitService service(boolean enabled) {
        Clock clock = Clock.fixed(Instant.parse("2026-08-09T10:30:15Z"), ZoneOffset.UTC);
        return new SecurityRateLimitService(mongoTemplate, enabled, clock);
    }
}
