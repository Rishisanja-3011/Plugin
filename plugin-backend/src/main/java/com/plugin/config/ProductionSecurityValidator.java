package com.plugin.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;

@Component
public class ProductionSecurityValidator {

    public ProductionSecurityValidator(
            @Value("${app.production:false}") boolean production,
            @Value("${app.rate-limit.enabled:true}") boolean rateLimitEnabled,
            @Value("${app.confirm.base-url:}") String applicationBaseUrl,
            @Value("${app.website.url:}") String websiteUrl) {
        if (!production) {
            return;
        }
        if (!rateLimitEnabled) {
            throw new IllegalStateException("The distributed rate limiter must be enabled in production");
        }
        validateExactHttpsOrigin("APP_BASE_URL", applicationBaseUrl);
        validateExactHttpsOrigin("WEBSITE_URL", websiteUrl);
    }

    private static void validateExactHttpsOrigin(String settingName, String configuredValue) {
        URI uri;
        try {
            uri = URI.create(configuredValue == null ? "" : configuredValue.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException(settingName + " must be one exact HTTPS origin");
        }

        boolean valid = "https".equalsIgnoreCase(uri.getScheme())
                && uri.getHost() != null
                && uri.getUserInfo() == null
                && uri.getQuery() == null
                && uri.getFragment() == null
                && (uri.getPath() == null || uri.getPath().isEmpty() || "/".equals(uri.getPath()))
                && !isLoopback(uri.getHost());
        if (!valid) {
            throw new IllegalStateException(settingName + " must be one exact non-loopback HTTPS origin");
        }
    }

    private static boolean isLoopback(String host) {
        return "localhost".equalsIgnoreCase(host)
                || "127.0.0.1".equals(host)
                || "::1".equals(host);
    }
}
