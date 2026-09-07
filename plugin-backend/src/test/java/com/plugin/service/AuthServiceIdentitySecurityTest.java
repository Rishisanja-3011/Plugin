package com.plugin.service;

import com.plugin.config.JwtService;
import com.plugin.dto.request.LoginRequest;
import com.plugin.dto.request.RegisterRequest;
import com.plugin.dto.response.AuthResponse;
import com.plugin.entity.PendingRegistration;
import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.repository.PendingRegistrationRepository;
import com.plugin.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceIdentitySecurityTest {

    @Mock private UserRepository userRepository;
    @Mock private PendingRegistrationRepository pendingRegistrationRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private OtpSecurityService otpSecurityService;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private SecurityRateLimitService securityRateLimitService;

    @Test
    void loginNormalizesInputAndFindsLegacyMixedCaseUser() {
        User legacyUser = User.builder()
                .id(7L)
                .email("Person@Example.Test")
                .password("stored-hash")
                .fullName("Person")
                .role(Role.CUSTOMER)
                .active(true)
                .tokenVersion(2L)
                .build();
        when(userRepository.findByEmailIgnoreCase("person@example.test"))
                .thenReturn(Optional.of(legacyUser));
        when(passwordEncoder.encode(anyString())).thenReturn("dummy-hash");
        when(passwordEncoder.matches("legacy-password", "stored-hash")).thenReturn(true);
        when(jwtService.generateToken(
                "Person@Example.Test", "CUSTOMER", 7L, 2L)).thenReturn("jwt");
        AuthService service = initializedService();
        LoginRequest request = new LoginRequest();
        request.setEmail(" Person@Example.Test ");
        request.setPassword("legacy-password");

        AuthResponse response = service.login(request);

        assertThat(response.getToken()).isEqualTo("jwt");
        verify(userRepository, times(2)).findByEmailIgnoreCase("person@example.test");
    }

    @Test
    void registrationPersistsCanonicalPendingEmail() {
        when(passwordEncoder.encode("long-enough-password")).thenReturn("stored-hash");
        when(otpSecurityService.hash(
                org.mockito.ArgumentMatchers.eq("person@example.test"),
                org.mockito.ArgumentMatchers.eq(OtpSecurityService.PURPOSE_REGISTRATION),
                anyString())).thenReturn("otp-hash");
        when(pendingRegistrationRepository.save(any(PendingRegistration.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        AuthService service = service();
        RegisterRequest request = new RegisterRequest();
        request.setFullName("Person");
        request.setEmail(" Person@Example.Test ");
        request.setPassword("long-enough-password");

        service.register(request);

        verify(userRepository).findByEmailIgnoreCase("person@example.test");
        verify(pendingRegistrationRepository).findByEmailIgnoreCase("person@example.test");
        ArgumentCaptor<PendingRegistration> captor = ArgumentCaptor.forClass(PendingRegistration.class);
        verify(pendingRegistrationRepository).save(captor.capture());
        assertThat(captor.getValue().getEmail()).isEqualTo("person@example.test");
    }

    private AuthService initializedService() {
        AuthService service = service();
        ReflectionTestUtils.setField(service, "googleClientIds", "allowed-client");
        ReflectionTestUtils.setField(service, "googleConnectTimeoutMs", 1_000);
        ReflectionTestUtils.setField(service, "googleReadTimeoutMs", 1_000);
        service.initializeSecurityClients();
        return service;
    }

    private AuthService service() {
        return new AuthService(
                userRepository,
                pendingRegistrationRepository,
                passwordEncoder,
                jwtService,
                otpSecurityService,
                mongoTemplate,
                new RestTemplateBuilder(),
                securityRateLimitService);
    }
}
