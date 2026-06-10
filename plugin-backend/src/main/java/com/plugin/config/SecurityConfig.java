package com.plugin.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    private static final RequestMatcher[] PUBLIC_STATION_MANAGER_MATCHERS = new RequestMatcher[] {
        new AntPathRequestMatcher("/api/station-manager/reference-data", HttpMethod.GET.name()),
        new AntPathRequestMatcher("/api/station-manager/status/**", HttpMethod.GET.name()),
        new AntPathRequestMatcher("/api/station-manager/application", HttpMethod.POST.name())
    };

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // Public endpoints
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/auth/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/stations/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/stations/*/charging-points").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/stations/*/pricing").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/charging-points/station/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/pricing/station/**").permitAll()
                .requestMatchers(PUBLIC_STATION_MANAGER_MATCHERS).permitAll()

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

                .requestMatchers("/stations/**").permitAll()// Allow public access to station images and files(While AWS deploy Below one linr also)
                .requestMatchers("/api/stations/**").permitAll()
                .anyRequest().authenticated()

            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of(
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
                "http://54.144.208.197",
                "http://plugin-v1.s3-website-us-east-1.amazonaws.com",
                "https://plugin-v1.s3-website-us-east-1.amazonaws.com",
                "http://*.s3-website-us-east-1.amazonaws.com",
                "http://*.s3-website.*.amazonaws.com",
                "https://plugin-ashen.vercel.app",
                "https://*.vercel.app"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
        config.setExposedHeaders(List.of("Content-Disposition", "X-Statement-Count"));
        config.setAllowCredentials(true);
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
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
