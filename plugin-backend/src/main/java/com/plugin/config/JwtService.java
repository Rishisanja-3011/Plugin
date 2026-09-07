package com.plugin.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.Optional;

@Service
public class JwtService {

    private static final int MINIMUM_SECRET_BYTES = 32;
    private static final String SIGNING_ALGORITHM = "HS256";

    private final SecretKey signingKey;
    private final long jwtExpirationMs;
    private final String issuer;
    private final String audience;

    public JwtService(@Value("${app.jwt.secret}") String jwtSecret,
                      @Value("${app.jwt.expiration-ms}") long jwtExpirationMs,
                      @Value("${app.jwt.issuer}") String issuer,
                      @Value("${app.jwt.audience}") String audience) {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException("JWT signing secret must be configured");
        }
        byte[] secretBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < MINIMUM_SECRET_BYTES) {
            throw new IllegalStateException("JWT signing secret must contain at least 32 bytes");
        }
        if (jwtExpirationMs <= 0) {
            throw new IllegalStateException("JWT expiration must be greater than zero");
        }
        if (issuer == null || issuer.isBlank() || audience == null || audience.isBlank()) {
            throw new IllegalStateException("JWT issuer and audience must be configured");
        }

        this.signingKey = Keys.hmacShaKeyFor(secretBytes);
        this.jwtExpirationMs = jwtExpirationMs;
        this.issuer = issuer.trim();
        this.audience = audience.trim();
    }

    public String generateToken(String email, String role, Long userId, long tokenVersion) {
        if (email == null || email.isBlank() || role == null || role.isBlank() || userId == null) {
            throw new IllegalArgumentException("Complete user identity is required to issue a JWT");
        }

        return Jwts.builder()
                .subject(String.valueOf(userId))
                .issuer(issuer)
                .audience().add(audience).and()
                .claims(Map.of(
                        "email", email,
                        "role", role,
                        "userId", userId,
                        "tokenVersion", tokenVersion
                ))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    public Optional<TokenIdentity> parseToken(String token) {
        try {
            Claims claims = getClaims(token);
            if (!issuer.equals(claims.getIssuer())
                    || claims.getAudience() == null
                    || !claims.getAudience().contains(audience)) {
                return Optional.empty();
            }

            Long userId = asLong(claims.get("userId"));
            Long tokenVersion = asLong(claims.get("tokenVersion"));
            String email = claims.get("email", String.class);
            String role = claims.get("role", String.class);
            if (userId == null || tokenVersion == null || email == null || email.isBlank()
                    || role == null || role.isBlank()) {
                return Optional.empty();
            }
            if (!String.valueOf(userId).equals(claims.getSubject())) {
                return Optional.empty();
            }
            return Optional.of(new TokenIdentity(userId, email, role, tokenVersion));
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    public String extractEmail(String token) {
        return getClaims(token).get("email", String.class);
    }

    public String extractRole(String token) {
        return getClaims(token).get("role", String.class);
    }

    public Long extractUserId(String token) {
        return asLong(getClaims(token).get("userId"));
    }

    public boolean isTokenValid(String token) {
        return parseToken(token).isPresent();
    }

    private Claims getClaims(String token) {
        Jws<Claims> parsed = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token);
        if (!SIGNING_ALGORITHM.equals(parsed.getHeader().getAlgorithm())) {
            throw new JwtException("Unexpected JWT signing algorithm");
        }
        return parsed.getPayload();
    }

    private Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String stringValue) {
            try {
                return Long.parseLong(stringValue);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    public record TokenIdentity(Long userId, String email, String role, long tokenVersion) {}
}
