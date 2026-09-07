package com.plugin.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionSecurityValidatorTest {

    @Test
    void acceptsExactHttpsOriginsWithDistributedLimitsEnabled() {
        assertThatCode(() -> new ProductionSecurityValidator(
                true, true, "https://api.plugin.example", "https://plugin.example"))
                .doesNotThrowAnyException();
    }

    @Test
    void permitsLocalDevelopmentConfigurationOutsideProduction() {
        assertThatCode(() -> new ProductionSecurityValidator(
                false, false, "http://localhost:8091", "http://localhost:5173"))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsDisabledDistributedRateLimitsInProduction() {
        assertThatThrownBy(() -> new ProductionSecurityValidator(
                true, false, "https://api.plugin.example", "https://plugin.example"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("rate limiter");
    }

    @Test
    void rejectsUnsafeProductionUrls() {
        assertThatThrownBy(() -> new ProductionSecurityValidator(
                true, true, "http://api.plugin.example", "https://plugin.example"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("APP_BASE_URL");
        assertThatThrownBy(() -> new ProductionSecurityValidator(
                true, true, "https://api.plugin.example", "https://user:pass@plugin.example"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("WEBSITE_URL");
        assertThatThrownBy(() -> new ProductionSecurityValidator(
                true, true, "https://localhost", "https://plugin.example"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("APP_BASE_URL");
    }
}
