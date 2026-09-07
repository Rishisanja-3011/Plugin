package com.plugin.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class SecurityConfigCorsTest {

    @Test
    void allowsOnlyConfiguredExactOriginsWithoutCredentials() {
        SecurityConfig securityConfig = new SecurityConfig(
                null,
                null,
                "http://localhost:5173,https://app.example.test",
                false
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/profile");
        CorsConfiguration cors = securityConfig.corsConfigurationSource().getCorsConfiguration(request);

        assertThat(cors).isNotNull();
        assertThat(cors.checkOrigin("https://app.example.test")).isEqualTo("https://app.example.test");
        assertThat(cors.checkOrigin("https://preview.vercel.app")).isNull();
        assertThat(cors.getAllowCredentials()).isFalse();
    }

    @Test
    void rejectsWildcardsAndNonLoopbackHttpOrigins() {
        assertThatThrownBy(() -> new SecurityConfig(null, null, "https://*.example.test", false))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new SecurityConfig(null, null, "http://app.example.test", false))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new SecurityConfig(null, null, "http://localhost:5173", true))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void customSecurityFiltersAreNotAlsoRegisteredAsServletFilters() {
        JwtAuthFilter jwtFilter = mock(JwtAuthFilter.class);
        SecurityRateLimitFilter rateLimitFilter = mock(SecurityRateLimitFilter.class);
        SecurityConfig securityConfig = new SecurityConfig(
                jwtFilter, rateLimitFilter, "http://localhost:5173", false);

        assertThat(securityConfig.disableJwtServletRegistration().isEnabled()).isFalse();
        assertThat(securityConfig.disableRateLimitServletRegistration().isEnabled()).isFalse();
    }
}
