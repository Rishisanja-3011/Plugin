package com.plugin.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plugin.service.SecurityRateLimitService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Component
public class SecurityRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_AUTH_REQUEST_BYTES = 32 * 1024;

    private final SecurityRateLimitService rateLimitService;
    private final TrustedClientIpResolver clientIpResolver;
    private final ObjectMapper objectMapper;

    public SecurityRateLimitFilter(SecurityRateLimitService rateLimitService,
                                   TrustedClientIpResolver clientIpResolver,
                                   ObjectMapper objectMapper) {
        this.rateLimitService = rateLimitService;
        this.clientIpResolver = clientIpResolver;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return policyFor(request.getMethod(), request.getServletPath()) == null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        Policy policy = policyFor(request.getMethod(), request.getServletPath());
        if (policy == null) {
            filterChain.doFilter(request, response);
            return;
        }

        HttpServletRequest effectiveRequest = request;
        String accountIdentity = authenticatedAccount();
        if (accountIdentity == null && policy.jsonIdentityField() != null) {
            if (request.getContentLengthLong() > MAX_AUTH_REQUEST_BYTES) {
                writeError(response, HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE,
                        "Request is too large", 0L);
                return;
            }
            byte[] body = request.getInputStream().readNBytes(MAX_AUTH_REQUEST_BYTES + 1);
            if (body.length > MAX_AUTH_REQUEST_BYTES) {
                writeError(response, HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE,
                        "Request is too large", 0L);
                return;
            }
            effectiveRequest = new CachedBodyRequest(request, body);
            accountIdentity = extractIdentity(body, policy.jsonIdentityField());
        }

        String clientIp = clientIpResolver.resolve(request);
        if (!consume(policy.ruleId(), "ip", clientIp, policy.ipLimit(), policy.window(), response)) {
            return;
        }
        if (accountIdentity != null && !accountIdentity.isBlank()
                && !consume(policy.ruleId(), policy.identityDimension(), accountIdentity,
                policy.accountLimit(), policy.window(), response)) {
            return;
        }

        filterChain.doFilter(effectiveRequest, response);
    }

    private boolean consume(String ruleId,
                            String dimension,
                            String identity,
                            int limit,
                            Duration window,
                            HttpServletResponse response) throws IOException {
        try {
            SecurityRateLimitService.Decision decision = rateLimitService.consume(
                    ruleId, dimension, identity, limit, window);
            if (decision.permitted()) {
                return true;
            }
            writeError(response, 429, "Too many requests. Please try again later.",
                    decision.retryAfterSeconds());
            return false;
        } catch (SecurityRateLimitService.RateLimitUnavailableException ex) {
            writeError(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                    "Security service temporarily unavailable", 5L);
            return false;
        }
    }

    private String authenticatedAccount() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        String name = authentication.getName();
        return name == null || name.isBlank() ? null : name.trim().toLowerCase(Locale.ROOT);
    }

    private String extractIdentity(byte[] body, String fieldName) {
        if (body.length == 0) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(body);
            JsonNode identity = node == null ? null : node.get(fieldName);
            if (identity == null || !identity.isTextual() || identity.textValue().isBlank()) {
                return null;
            }
            String normalized = identity.textValue().trim();
            return "email".equals(fieldName) ? normalized.toLowerCase(Locale.ROOT) : normalized;
        } catch (IOException ex) {
            return null;
        }
    }

    private void writeError(HttpServletResponse response,
                            int status,
                            String message,
                            long retryAfterSeconds) throws IOException {
        response.resetBuffer();
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        if (retryAfterSeconds > 0) {
            response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status);
        body.put("error", status == 429 ? "Too Many Requests" : "Request Rejected");
        body.put("message", message);
        objectMapper.writeValue(response.getWriter(), body);
    }

    private Policy policyFor(String method, String path) {
        if (!"POST".equalsIgnoreCase(method) && !"GET".equalsIgnoreCase(method)) {
            return null;
        }

        if ("POST".equalsIgnoreCase(method)) {
            if ("/api/auth/login".equals(path)) {
                return Policy.forJsonIdentity("auth-login", 30, 10, Duration.ofMinutes(15), "email");
            }
            if ("/api/auth/register".equals(path)) {
                return Policy.forJsonIdentity("auth-register", 10, 3, Duration.ofHours(1), "email");
            }
            if ("/api/auth/google".equals(path)) {
                return Policy.forJsonCredential(
                        "auth-google", 20, 20, Duration.ofMinutes(1), "idToken");
            }
            if ("/api/auth/resend-otp".equals(path)
                    || "/api/auth/forgot-password/send-otp".equals(path)) {
                return Policy.forJsonIdentity("otp-send", 10, 3, Duration.ofMinutes(10), "email");
            }
            if ("/api/auth/confirm-otp".equals(path)
                    || "/api/auth/forgot-password/verify-otp".equals(path)) {
                return Policy.forJsonIdentity("otp-verify", 30, 6, Duration.ofMinutes(10), "email");
            }
            if ("/api/auth/forgot-password".equals(path)) {
                return Policy.forJsonIdentity("account-recovery-check", 30, 10, Duration.ofMinutes(10), "email");
            }
            if ("/api/auth/forgot-password/reset".equals(path)) {
                return Policy.forJsonIdentity("account-recovery-final", 15, 5, Duration.ofMinutes(15), "email");
            }
            if ("/api/station-manager/access/setup".equals(path)) {
                return Policy.forJsonCredential(
                        "station-manager-access-setup", 20, 6, Duration.ofMinutes(15), "token");
            }
            if (path != null && path.startsWith("/api/profile/") && path.endsWith("/send-otp")) {
                return Policy.forAccount("otp-send", 10, 3, Duration.ofMinutes(10));
            }
            if (path != null && path.startsWith("/api/profile/") && path.endsWith("/verify-otp")) {
                return Policy.forAccount("otp-verify", 30, 6, Duration.ofMinutes(10));
            }
            if (isProfileSecurityAction(path)) {
                return Policy.forAccount("account-recovery-final", 15, 5, Duration.ofMinutes(15));
            }
            if ("/api/station-manager/application".equals(path)) {
                return Policy.forAccount("kyc-submit", 10, 3, Duration.ofHours(1));
            }
            if ("/api/bookings".equals(path)) {
                return Policy.forAccount("booking-create", 60, 10, Duration.ofMinutes(10));
            }
            if (matchesSingleSegment(path, "/api/bookings/", "/location")) {
                return Policy.forAccount("booking-location", 120, 1, Duration.ofSeconds(30));
            }
            if ("/api/wallet/topup/order".equals(path)
                    || "/api/wallet/mandate/order".equals(path)) {
                return Policy.forAccount("wallet-order", 30, 5, Duration.ofMinutes(10));
            }
            if ("/api/wallet/topup/verify".equals(path)
                    || "/api/wallet/mandate/verify".equals(path)) {
                return Policy.forAccount("wallet-verify", 60, 10, Duration.ofMinutes(10));
            }
            if ("/api/wallet/withdraw".equals(path)) {
                return Policy.forAccount("wallet-withdraw", 20, 3, Duration.ofMinutes(10));
            }
            if (matchesSingleSegment(path, "/api/bills/my/", "/wallet-pay")) {
                return Policy.forAccount("bill-wallet-pay", 40, 10, Duration.ofMinutes(10));
            }
        }

        if ("GET".equalsIgnoreCase(method)) {
            if (path != null && path.startsWith("/api/station-manager/status/")) {
                return Policy.forAccount("kyc-status", 120, 60, Duration.ofMinutes(1));
            }
            if ("/api/stations/search".equals(path)) {
                return Policy.forAccount("station-search", 120, 60, Duration.ofMinutes(1));
            }
            if (matchesSingleSegment(path, "/api/bills/my/", "/invoice")) {
                return Policy.forAccount("invoice-export", 60, 20, Duration.ofMinutes(10));
            }
            if ("/api/bills/my/statement".equals(path)) {
                return Policy.forAccount("statement-export", 30, 10, Duration.ofMinutes(10));
            }
        }
        return null;
    }

    private boolean matchesSingleSegment(String path, String prefix, String suffix) {
        if (path == null || !path.startsWith(prefix) || !path.endsWith(suffix)) {
            return false;
        }
        int valueStart = prefix.length();
        int valueEnd = path.length() - suffix.length();
        if (valueEnd <= valueStart) {
            return false;
        }
        return path.substring(valueStart, valueEnd).indexOf('/') < 0;
    }

    private boolean isProfileSecurityAction(String path) {
        return "/api/profile/delete".equals(path)
                || "/api/profile/delete/forgot".equals(path)
                || "/api/profile/change-password".equals(path)
                || "/api/profile/change-password/forgot".equals(path);
    }

    private record Policy(String ruleId,
                          int ipLimit,
                          int accountLimit,
                          Duration window,
                          String jsonIdentityField,
                          String identityDimension) {

        private static Policy forAccount(String ruleId, int ipLimit, int accountLimit, Duration window) {
            return new Policy(ruleId, ipLimit, accountLimit, window, null, "account");
        }

        private static Policy forJsonIdentity(String ruleId, int ipLimit, int accountLimit,
                                              Duration window, String fieldName) {
            return new Policy(ruleId, ipLimit, accountLimit, window, fieldName, "account");
        }

        private static Policy forJsonCredential(String ruleId, int ipLimit, int credentialLimit,
                                                Duration window, String fieldName) {
            return new Policy(ruleId, ipLimit, credentialLimit, window, fieldName, "credential");
        }
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        private CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body.clone();
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() {
                    return input.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener readListener) {
                    // Synchronous request processing only.
                }

                @Override
                public int read() {
                    return input.read();
                }

                @Override
                public int read(byte[] target, int offset, int length) {
                    return input.read(target, offset, length);
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
        }
    }
}
