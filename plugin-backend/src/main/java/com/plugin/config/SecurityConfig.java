package com.plugin.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.net.URI;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final RequestMatcher[] PUBLIC_AUTH_MATCHERS = new RequestMatcher[] {
            post("/api/auth/register"),
            post("/api/auth/login"),
            post("/api/auth/google"),
            post("/api/auth/confirm-otp"),
            post("/api/auth/resend-otp"),
            post("/api/auth/forgot-password"),
            post("/api/auth/forgot-password/send-otp"),
            post("/api/auth/forgot-password/verify-otp"),
            post("/api/auth/forgot-password/reset")
    };

    private final JwtAuthFilter jwtAuthFilter;
    private final SecurityRateLimitFilter securityRateLimitFilter;
    private final List<String> allowedOrigins;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter,
                          SecurityRateLimitFilter securityRateLimitFilter,
                          @Value("${app.cors.allowed-origins}") String allowedOrigins,
                          @Value("${app.production:false}") boolean production) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.allowedOrigins = parseAllowedOrigins(allowedOrigins);
        this.securityRateLimitFilter = securityRateLimitFilter;
        if (production && this.allowedOrigins.stream().anyMatch(SecurityConfig::isLoopbackOrigin)) {
            throw new IllegalStateException("Production CORS origins must not use loopback hosts");
        }
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> {
                    headers.contentSecurityPolicy(csp -> csp.policyDirectives(
                            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"));
                    headers.frameOptions(frame -> frame.deny());
                    headers.referrerPolicy(referrer -> referrer.policy(
                            ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER));
                    headers.permissionsPolicy(permissions -> permissions.policy(
                            "camera=(), microphone=(), geolocation=(), payment=()"));
                    headers.httpStrictTransportSecurity(hsts -> hsts
                            .includeSubDomains(true)
                            .preload(true)
                            .maxAgeInSeconds(31_536_000));
                })
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        .requestMatchers(PUBLIC_AUTH_MATCHERS).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/stations/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/charging-points/station/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/pricing/station/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/stations/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/station-manager/reference-data").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/station-manager/access/setup").permitAll()

                        // Explicitly close every unspecified method below a public namespace.
                        .requestMatchers("/api/auth/**", "/auth/**").denyAll()
                        .requestMatchers("/api/stations/**").denyAll()
                        .requestMatchers("/api/charging-points/station/**").denyAll()
                        .requestMatchers("/api/pricing/station/**").denyAll()
                        .requestMatchers("/stations/**").denyAll()

                        .requestMatchers(HttpMethod.GET, "/api/station-manager/status/**")
                        .hasAnyRole("CUSTOMER", "STATION_OPERATOR")
                        .requestMatchers(HttpMethod.POST, "/api/station-manager/application")
                        .hasAnyRole("CUSTOMER", "STATION_OPERATOR")
                        .requestMatchers(HttpMethod.POST, "/api/station-manager/session")
                        .hasRole("STATION_OPERATOR")
                        .requestMatchers("/api/station-manager/**")
                        .hasAnyRole("CUSTOMER", "STATION_OPERATOR")

                        .requestMatchers("/api/bookings/**").hasRole("CUSTOMER")
                        .requestMatchers("/api/sessions/**").hasRole("CUSTOMER")
                        .requestMatchers("/api/bills/**").hasRole("CUSTOMER")
                        .requestMatchers("/api/wallet/**").hasRole("CUSTOMER")
                        .requestMatchers("/api/profile/**")
                        .hasAnyRole("CUSTOMER", "ADMIN", "STATION_OPERATOR")

                        .requestMatchers("/api/admin/dashboard").hasAnyRole("ADMIN", "STATION_OPERATOR")
                        .requestMatchers("/api/admin/stations/**").hasAnyRole("ADMIN", "STATION_OPERATOR")
                        .requestMatchers("/api/admin/charging-points/**").hasAnyRole("ADMIN", "STATION_OPERATOR")
                        .requestMatchers("/api/admin/pricing/**").hasAnyRole("ADMIN", "STATION_OPERATOR")
                        .requestMatchers("/api/admin/station-manager-applications/**").hasRole("ADMIN")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        .requestMatchers("/api/notifications/**").authenticated()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(securityRateLimitFilter, JwtAuthFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of(
                "Authorization",
                "Content-Type",
                "Accept",
                "Origin",
                "X-Requested-With",
                "Cache-Control",
                "Pragma"
        ));
        config.setExposedHeaders(List.of("Content-Disposition", "X-Statement-Count"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public FilterRegistrationBean<JwtAuthFilter> disableJwtServletRegistration() {
        FilterRegistrationBean<JwtAuthFilter> registration = new FilterRegistrationBean<>(jwtAuthFilter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public FilterRegistrationBean<SecurityRateLimitFilter> disableRateLimitServletRegistration() {
        FilterRegistrationBean<SecurityRateLimitFilter> registration =
                new FilterRegistrationBean<>(securityRateLimitFilter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    private static RequestMatcher post(String path) {
        return new AntPathRequestMatcher(path, HttpMethod.POST.name());
    }

    private static List<String> parseAllowedOrigins(String configuredOrigins) {
        if (configuredOrigins == null || configuredOrigins.isBlank()) {
            throw new IllegalStateException("At least one exact CORS origin must be configured");
        }

        List<String> origins = Arrays.stream(configuredOrigins.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .peek(SecurityConfig::validateOrigin)
                .toList();
        if (origins.isEmpty()) {
            throw new IllegalStateException("At least one exact CORS origin must be configured");
        }
        return origins;
    }

    private static void validateOrigin(String origin) {
        if (origin.contains("*")) {
            throw new IllegalStateException("Wildcard CORS origins are not allowed");
        }

        URI uri;
        try {
            uri = URI.create(origin);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("A configured CORS origin is invalid");
        }

        boolean validShape = uri.getHost() != null
                && uri.getUserInfo() == null
                && uri.getQuery() == null
                && uri.getFragment() == null
                && (uri.getPath() == null || uri.getPath().isEmpty());
        if (!validShape) {
            throw new IllegalStateException("CORS entries must be exact origins without paths");
        }

        if ("https".equalsIgnoreCase(uri.getScheme())) {
            return;
        }
        boolean loopbackHttp = "http".equalsIgnoreCase(uri.getScheme())
                && ("localhost".equalsIgnoreCase(uri.getHost())
                || "127.0.0.1".equals(uri.getHost())
                || "::1".equals(uri.getHost()));
        if (!loopbackHttp) {
            throw new IllegalStateException("Non-loopback CORS origins must use HTTPS");
        }
    }

    private static boolean isLoopbackOrigin(String origin) {
        URI uri = URI.create(origin);
        return "localhost".equalsIgnoreCase(uri.getHost())
                || "127.0.0.1".equals(uri.getHost())
                || "::1".equals(uri.getHost());
    }
}
