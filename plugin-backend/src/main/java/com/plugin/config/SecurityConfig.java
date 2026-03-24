package com.plugin.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(request -> {
                var config = new org.springframework.web.cors.CorsConfiguration();
                // Allow local dev + LAN origins (needed for testing on other devices)
                config.setAllowedOriginPatterns(java.util.List.of(
                    "http://localhost:*",
                    "http://127.0.0.1:*",
                    "http://10.*.*.*:*",
                    "http://172.16.*.*:*",
                    "http://172.17.*.*:*",
                    "http://172.18.*.*:*",
                    "http://172.19.*.*:*",
                    "http://172.20.*.*:*",
                    "http://172.21.*.*:*",
                    "http://172.22.*.*:*",
                    "http://172.23.*.*:*",
                    "http://172.24.*.*:*",
                    "http://172.25.*.*:*",
                    "http://172.26.*.*:*",
                    "http://172.27.*.*:*",
                    "http://172.28.*.*:*",
                    "http://172.29.*.*:*",
                    "http://172.30.*.*:*",
                    "http://172.31.*.*:*",
                    "http://192.168.*.*:*",
                    "https://plugin-ashen.vercel.app",
                    "https://*.vercel.app"

                ));
                config.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
                config.setAllowedHeaders(java.util.List.of("*"));
                config.setExposedHeaders(java.util.List.of("Content-Disposition", "X-Statement-Count"));
                config.setAllowCredentials(true);
                config.setMaxAge(3600L);
                return config;
            }))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/stations/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/stations/*/charging-points").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/stations/*/pricing").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/charging-points/station/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/pricing/station/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/station-manager/reference-data").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/station-manager/status/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/station-manager/application").permitAll()

                // Customer endpoints
                .requestMatchers("/api/bookings/**").hasAnyRole("CUSTOMER", "ADMIN", "STATION_OPERATOR")
                .requestMatchers("/api/sessions/my/**").hasRole("CUSTOMER")
                .requestMatchers("/api/bills/my/**").hasRole("CUSTOMER")
                .requestMatchers("/api/profile/**").hasAnyRole("CUSTOMER", "ADMIN", "STATION_OPERATOR")
                .requestMatchers("/api/station-manager/**").authenticated()

                // Station operator endpoints
                .requestMatchers("/api/admin/dashboard").hasAnyRole("ADMIN", "STATION_OPERATOR")
                .requestMatchers("/api/admin/stations/**").hasAnyRole("ADMIN", "STATION_OPERATOR")
                .requestMatchers("/api/admin/charging-points/**").hasAnyRole("ADMIN", "STATION_OPERATOR")
                .requestMatchers("/api/admin/pricing/**").hasAnyRole("ADMIN", "STATION_OPERATOR")

                // Admin-only endpoints
                .requestMatchers("/api/admin/station-manager-applications/**").hasRole("ADMIN")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                // Notifications
                .requestMatchers("/api/notifications/**").authenticated()

                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
