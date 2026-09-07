package com.plugin.service;

import com.plugin.dto.request.StationManagerAccessSetupRequest;
import com.plugin.entity.StationManagerAccessInvitation;
import com.plugin.entity.StationManagerApplication;
import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.StationManagerAccessInvitationRepository;
import com.plugin.repository.StationManagerApplicationRepository;
import com.plugin.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationManagerAccessSetupServiceTest {

    @Mock private StationManagerAccessInvitationRepository invitationRepository;
    @Mock private StationManagerApplicationRepository applicationRepository;
    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private StationManagerCredentialEmailService emailService;

    @InjectMocks
    private StationManagerAccessSetupService service;

    @Test
    void invitationStoresOnlyHashAndEmailsOneTimeToken() {
        User user = User.builder().id(7L).email("operator@plugin.com").role(Role.STATION_OPERATOR).active(false).build();
        StationManagerApplication application = StationManagerApplication.builder()
                .id(8L)
                .email("applicant@example.com")
                .fullName("Applicant")
                .user(user)
                .build();
        when(invitationRepository.findByApplicationIdAndUsedAtIsNull(8L)).thenReturn(List.of());
        when(invitationRepository.save(any(StationManagerAccessInvitation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.issueInvitation(application, user, "admin@example.com");

        ArgumentCaptor<StationManagerAccessInvitation> stored = ArgumentCaptor.forClass(StationManagerAccessInvitation.class);
        ArgumentCaptor<String> rawToken = ArgumentCaptor.forClass(String.class);
        verify(invitationRepository).save(stored.capture());
        verify(emailService).sendAccessInvitation(
                org.mockito.ArgumentMatchers.eq("applicant@example.com"),
                org.mockito.ArgumentMatchers.eq("Applicant"),
                org.mockito.ArgumentMatchers.eq("operator@plugin.com"),
                rawToken.capture()
        );
        assertTrue(rawToken.getValue().length() >= 40);
        assertNotEquals(rawToken.getValue(), stored.getValue().getTokenHash());
        assertFalse(stored.getValue().getTokenHash().isBlank());
    }

    @Test
    void setupActivatesUserRevokesOldSessionsAndConsumesInvitationOnce() {
        User user = User.builder().id(7L).email("operator@plugin.com").role(Role.STATION_OPERATOR).active(false).build();
        StationManagerApplication application = StationManagerApplication.builder().id(8L).user(user).build();
        StationManagerAccessInvitation invitation = StationManagerAccessInvitation.builder()
                .id("invite")
                .applicationId(8L)
                .userId(7L)
                .tokenHash("hash")
                .build();
        StationManagerAccessSetupRequest request = new StationManagerAccessSetupRequest();
        request.setToken("a-valid-random-token-with-more-than-thirty-two-characters");
        request.setNewPassword("StrongPassword!123");
        request.setConfirmPassword("StrongPassword!123");

        when(invitationRepository.findByTokenHashAndUsedAtIsNullAndExpiresAtAfter(anyString(), any()))
                .thenReturn(Optional.of(invitation), Optional.empty());
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(applicationRepository.findById(8L)).thenReturn(Optional.of(application));
        when(passwordEncoder.encode("StrongPassword!123")).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(invitationRepository.save(any(StationManagerAccessInvitation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(applicationRepository.save(any(StationManagerApplication.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.completeSetup(request);

        assertTrue(user.getActive());
        assertTrue(user.currentTokenVersion() > 0);
        assertNotNull(invitation.getUsedAt());
        assertNotNull(application.getCredentialsIssuedAt());
        assertThrows(BadRequestException.class, () -> service.completeSetup(request));
    }
}
