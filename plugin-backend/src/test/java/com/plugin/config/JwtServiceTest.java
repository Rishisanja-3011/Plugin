package com.plugin.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String TEST_KEY = "unit-test-jwt-key-that-is-long-enough-for-hmac-sha256-only";

    @Test
    void rejectsMissingOrWeakSigningSecrets() {
        assertThatThrownBy(() -> new JwtService("", 60_000, "issuer", "audience"))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new JwtService("too-short", 60_000, "issuer", "audience"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void issuesAndParsesVersionedIdentityWithIssuerAndAudience() {
        JwtService service = new JwtService(TEST_KEY, 60_000, "plugin-test", "plugin-clients-test");

        String token = service.generateToken("user@example.test", "CUSTOMER", 42L, 7L);

        assertThat(service.parseToken(token)).contains(
                new JwtService.TokenIdentity(42L, "user@example.test", "CUSTOMER", 7L));
    }

    @Test
    void rejectsTokenFromWrongIssuerOrAudience() {
        JwtService issuerA = new JwtService(TEST_KEY, 60_000, "issuer-a", "audience-a");
        JwtService issuerB = new JwtService(TEST_KEY, 60_000, "issuer-b", "audience-a");
        JwtService audienceB = new JwtService(TEST_KEY, 60_000, "issuer-a", "audience-b");
        String token = issuerA.generateToken("user@example.test", "CUSTOMER", 42L, 0L);

        assertThat(issuerB.parseToken(token)).isEmpty();
        assertThat(audienceB.parseToken(token)).isEmpty();
    }

    @Test
    void rejectsExpiredToken() {
        JwtService service = new JwtService(TEST_KEY, 1, "plugin-test", "plugin-clients-test");
        String token = service.generateToken("user@example.test", "CUSTOMER", 42L, 0L);

        try {
            Thread.sleep(5);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }

        assertThat(service.parseToken(token)).isEmpty();
    }

    @Test
    void rejectsValidSignatureCreatedWithAnUnapprovedHmacAlgorithm() {
        JwtService service = new JwtService(TEST_KEY, 60_000, "plugin-test", "plugin-clients-test");
        String token = Jwts.builder()
                .subject("42")
                .issuer("plugin-test")
                .audience().add("plugin-clients-test").and()
                .claims(Map.of(
                        "email", "user@example.test",
                        "role", "CUSTOMER",
                        "userId", 42L,
                        "tokenVersion", 0L
                ))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(TEST_KEY.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS384)
                .compact();

        assertThat(service.parseToken(token)).isEmpty();
    }
}
