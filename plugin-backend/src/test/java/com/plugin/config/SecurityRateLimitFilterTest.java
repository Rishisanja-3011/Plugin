package com.plugin.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.plugin.service.SecurityRateLimitService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SecurityRateLimitFilterTest {

    @Mock
    private SecurityRateLimitService rateLimitService;

    private SecurityRateLimitFilter filter;

    @BeforeEach
    void setUp() {
        when(rateLimitService.consume(anyString(), anyString(), anyString(), anyInt(), any(Duration.class)))
                .thenReturn(SecurityRateLimitService.Decision.allowed());
        filter = new SecurityRateLimitFilter(
                rateLimitService,
                new TrustedClientIpResolver(""),
                new ObjectMapper());
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void appliesIpAndNormalizedAccountLimitsWithoutConsumingLoginBody() throws Exception {
        MockHttpServletRequest request = post("/api/auth/login",
                "{\"email\":\" Person@Example.Test \",\"password\":\"not-used\"}");
        request.setRemoteAddr("203.0.113.8");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(chain.getRequest().getInputStream().readAllBytes())
                .isEqualTo(request.getContentAsByteArray());
        verify(rateLimitService).consume(
                "auth-login", "ip", "203.0.113.8", 30, Duration.ofMinutes(15));
        verify(rateLimitService).consume(
                "auth-login", "account", "person@example.test", 10, Duration.ofMinutes(15));
    }

    @Test
    void returns429AndRetryAfterWithoutInvokingController() throws Exception {
        when(rateLimitService.consume("auth-login", "ip", "203.0.113.8", 30, Duration.ofMinutes(15)))
                .thenReturn(SecurityRateLimitService.Decision.blocked(42));
        MockHttpServletRequest request = post("/api/auth/login", "{}");
        request.setRemoteAddr("203.0.113.8");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getHeader("Retry-After")).isEqualTo("42");
        assertThat(response.getContentAsString()).contains("Too many requests");
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    void keysKycLimitsByAuthenticatedAccountWithoutReadingMultipartBody() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(
                        "operator@example.test", null, java.util.List.of()));
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/station-manager/application");
        request.setServletPath("/api/station-manager/application");
        request.setRemoteAddr("203.0.113.9");

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        verify(rateLimitService).consume(
                "kyc-submit", "account", "operator@example.test", 3, Duration.ofHours(1));
    }

    @Test
    void limitsAccessSetupByIpAndCaseSensitiveInvitationTokenWithoutConsumingBody() throws Exception {
        MockHttpServletRequest request = post("/api/station-manager/access/setup",
                "{\"token\":\" CaseSensitive_Token \" ,\"password\":\"not-used\"}");
        request.setRemoteAddr("203.0.113.10");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(chain.getRequest().getInputStream().readAllBytes())
                .isEqualTo(request.getContentAsByteArray());
        verify(rateLimitService).consume(
                "station-manager-access-setup", "ip", "203.0.113.10", 20, Duration.ofMinutes(15));
        verify(rateLimitService).consume(
                "station-manager-access-setup", "credential", "CaseSensitive_Token", 6,
                Duration.ofMinutes(15));
    }

    @ParameterizedTest
    @MethodSource("expensiveAuthenticatedEndpoints")
    void limitsExpensiveEndpointsByIpAndAuthenticatedAccount(
            String method,
            String path,
            String ruleId,
            int ipLimit,
            int accountLimit,
            Duration window) throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(
                        "customer@example.test", null, java.util.List.of()));
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setServletPath(path);
        request.setRemoteAddr("203.0.113.11");

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        verify(rateLimitService).consume(
                ruleId, "ip", "203.0.113.11", ipLimit, window);
        verify(rateLimitService).consume(
                ruleId, "account", "customer@example.test", accountLimit, window);
    }

    @Test
    void limitsPublicStationSearchByClientIp() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/stations/search");
        request.setServletPath("/api/stations/search");
        request.setRemoteAddr("203.0.113.12");

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        verify(rateLimitService).consume(
                "station-search", "ip", "203.0.113.12", 120, Duration.ofMinutes(1));
    }

    private static Stream<Arguments> expensiveAuthenticatedEndpoints() {
        return Stream.of(
                Arguments.of("POST", "/api/bookings", "booking-create",
                        60, 10, Duration.ofMinutes(10)),
                Arguments.of("POST", "/api/bookings/42/location", "booking-location",
                        120, 1, Duration.ofSeconds(30)),
                Arguments.of("GET", "/api/bills/my/42/invoice", "invoice-export",
                        60, 20, Duration.ofMinutes(10)),
                Arguments.of("GET", "/api/bills/my/statement", "statement-export",
                        30, 10, Duration.ofMinutes(10)),
                Arguments.of("POST", "/api/wallet/topup/order", "wallet-order",
                        30, 5, Duration.ofMinutes(10)),
                Arguments.of("POST", "/api/wallet/topup/verify", "wallet-verify",
                        60, 10, Duration.ofMinutes(10)),
                Arguments.of("POST", "/api/wallet/withdraw", "wallet-withdraw",
                        20, 3, Duration.ofMinutes(10)),
                Arguments.of("POST", "/api/bills/my/42/wallet-pay", "bill-wallet-pay",
                        40, 10, Duration.ofMinutes(10))
        );
    }

    private MockHttpServletRequest post(String path, String body) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setServletPath(path);
        request.setContentType("application/json");
        request.setContent(body.getBytes(StandardCharsets.UTF_8));
        return request;
    }
}
