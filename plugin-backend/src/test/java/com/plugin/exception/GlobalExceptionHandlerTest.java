package com.plugin.exception;

import com.plugin.service.SecurityRateLimitService;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    @Test
    void unexpectedErrorsNeverExposeInternalMessages() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        var response = handler.handleGeneral(
                new IllegalStateException("sensitive internal database detail"));

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage()).isEqualTo("An unexpected error occurred");
        assertThat(response.getBody().getMessage()).doesNotContain("database detail");
        assertThat(response.getBody().getReferenceId()).isNotBlank();
    }

    @Test
    void rateLimitResponsesExposeOnlyRetryGuidance() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        var limited = handler.handleRateLimitExceeded(new RateLimitExceededException(42));
        var unavailable = handler.handleRateLimitUnavailable();

        assertThat(limited.getStatusCode().value()).isEqualTo(429);
        assertThat(limited.getHeaders().getFirst("Retry-After")).isEqualTo("42");
        assertThat(unavailable.getStatusCode().value()).isEqualTo(503);
        assertThat(unavailable.getHeaders().getFirst("Retry-After")).isEqualTo("5");
        assertThat(unavailable.getBody().getMessage()).doesNotContain("Mongo");
    }
}
