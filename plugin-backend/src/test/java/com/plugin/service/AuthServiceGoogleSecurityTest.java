package com.plugin.service;

import com.plugin.config.JwtService;
import com.plugin.dto.request.GoogleAuthRequest;
import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.PendingRegistrationRepository;
import com.plugin.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ExtendWith(MockitoExtension.class)
class AuthServiceGoogleSecurityTest {

    @Mock private UserRepository userRepository;
    @Mock private PendingRegistrationRepository pendingRegistrationRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private OtpSecurityService otpSecurityService;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private SecurityRateLimitService securityRateLimitService;

    private AuthService service;
    private MockRestServiceServer googleServer;

    @BeforeEach
    void setUp() {
        when(passwordEncoder.encode(anyString())).thenReturn("encoded");
        service = new AuthService(
                userRepository,
                pendingRegistrationRepository,
                passwordEncoder,
                jwtService,
                otpSecurityService,
                mongoTemplate,
                new RestTemplateBuilder(),
                securityRateLimitService);
        lenient().when(securityRateLimitService.consume(
                        anyString(), anyString(), anyString(), org.mockito.ArgumentMatchers.anyInt(),
                        org.mockito.ArgumentMatchers.any(Duration.class)))
                .thenReturn(SecurityRateLimitService.Decision.allowed());
        ReflectionTestUtils.setField(service, "googleClientIds", "allowed-client");
        ReflectionTestUtils.setField(service, "googleConnectTimeoutMs", 1_000);
        ReflectionTestUtils.setField(service, "googleReadTimeoutMs", 1_000);
        service.initializeSecurityClients();
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        googleServer = MockRestServiceServer.bindTo(restTemplate).build();
    }

    @Test
    void rejectsIdTokenWithMissingAudience() {
        long expiry = Instant.now().plusSeconds(3_600).getEpochSecond();
        googleServer.expect(requestTo("https://oauth2.googleapis.com/tokeninfo?id_token=id-token"))
                .andRespond(withSuccess("""
                        {"iss":"https://accounts.google.com","exp":"%d","sub":"subject-1",
                         "email":"person@example.test","email_verified":true}
                        """.formatted(expiry), MediaType.APPLICATION_JSON));
        GoogleAuthRequest request = new GoogleAuthRequest();
        request.setIdToken("id-token");

        assertThatThrownBy(() -> service.googleLogin(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Google client is not allowed for this app");
        googleServer.verify();
    }

    @Test
    void rejectsUnlinkedPrivilegedGoogleLoginEvenWithVerifiedEmail() {
        long expiry = Instant.now().plusSeconds(3_600).getEpochSecond();
        googleServer.expect(requestTo("https://oauth2.googleapis.com/tokeninfo?id_token=admin-token"))
                .andRespond(withSuccess("""
                        {"iss":"https://accounts.google.com","aud":"allowed-client","exp":"%d",
                         "sub":"subject-2","email":"admin@example.test","email_verified":true}
                        """.formatted(expiry), MediaType.APPLICATION_JSON));
        when(userRepository.findByEmailIgnoreCase("admin@example.test")).thenReturn(Optional.of(User.builder()
                .id(9L)
                .email("admin@example.test")
                .password("encoded")
                .role(Role.ADMIN)
                .active(true)
                .build()));
        GoogleAuthRequest request = new GoogleAuthRequest();
        request.setIdToken("admin-token");

        assertThatThrownBy(() -> service.googleLogin(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Google sign-in is not linked to this privileged account");
        googleServer.verify();
    }

    @Test
    void rejectsAccessTokenWithoutAuthorizedClientClaim() {
        googleServer.expect(requestTo("https://oauth2.googleapis.com/tokeninfo?access_token=access-token"))
                .andRespond(withSuccess("""
                        {"expires_in":"3600","scope":"email","sub":"subject-3"}
                        """, MediaType.APPLICATION_JSON));
        GoogleAuthRequest request = new GoogleAuthRequest();
        request.setAccessToken("access-token");

        assertThatThrownBy(() -> service.googleLogin(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Google client is not allowed for this app");
        googleServer.verify();
    }

    @Test
    void limitsGoogleLoginByVerifiedAccountIdentity() {
        long expiry = Instant.now().plusSeconds(3_600).getEpochSecond();
        googleServer.expect(requestTo("https://oauth2.googleapis.com/tokeninfo?id_token=limited-token"))
                .andRespond(withSuccess("""
                        {"iss":"https://accounts.google.com","aud":"allowed-client","exp":"%d",
                         "sub":"subject-limited","email":"limited@example.test","email_verified":true}
                        """.formatted(expiry), MediaType.APPLICATION_JSON));
        when(securityRateLimitService.consume(
                "auth-google-verified", "account", "limited@example.test", 20, Duration.ofMinutes(1)))
                .thenReturn(SecurityRateLimitService.Decision.blocked(37));
        GoogleAuthRequest request = new GoogleAuthRequest();
        request.setIdToken("limited-token");

        assertThatThrownBy(() -> service.googleLogin(request))
                .isInstanceOf(com.plugin.exception.RateLimitExceededException.class)
                .hasMessage("Too many requests. Please try again later.");
        googleServer.verify();
    }
}
