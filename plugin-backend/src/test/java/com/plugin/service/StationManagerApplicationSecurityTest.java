package com.plugin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.plugin.dto.request.StationManagerApplicationRequest;
import com.plugin.dto.request.StationManagerCredentialIssueRequest;
import com.plugin.dto.request.StationManagerReviewRequest;
import com.plugin.dto.response.StationManagerStatusLookupResponse;
import com.plugin.entity.StationManagerApplication;
import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.enums.StationManagerApplicationStatus;
import com.plugin.enums.StationManagerFileSlot;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.StationManagerApplicationRepository;
import com.plugin.repository.StationRepository;
import com.plugin.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.domain.PageRequest;

import java.util.Map;
import java.util.Optional;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationManagerApplicationSecurityTest {

    @Mock private StationManagerApplicationRepository applicationRepository;
    @Mock private UserRepository userRepository;
    @Mock private StationRepository stationRepository;
    @Mock private AuditService auditService;
    @Mock private AuthService authService;
    @Mock private StationManagerFileService stationManagerFileService;
    @Mock private StationManagerDirectoryService stationManagerDirectoryService;
    @Mock private StationManagerTrackingEmailService stationManagerTrackingEmailService;
    @Mock private StationManagerAccessSetupService stationManagerAccessSetupService;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks
    private StationManagerApplicationService service;

    @Test
    void legacySequentialReferenceNeverFallsBackToDatabaseId() {
        when(applicationRepository.findByApplicationReferenceId("00000000001"))
                .thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.getStatusByReferenceId("00000000001", "applicant@example.com"));
        verify(applicationRepository, never()).findById(anyLong());
    }

    @Test
    void trackingReferenceCannotReadAnotherApplicantsStatus() {
        User victim = User.builder().id(1L).email("victim@example.com").role(Role.CUSTOMER).active(true).build();
        User attacker = User.builder().id(2L).email("attacker@example.com").role(Role.CUSTOMER).active(true).build();
        StationManagerApplication application = StationManagerApplication.builder()
                .id(9L)
                .applicationReferenceId("12345678901")
                .email(victim.getEmail())
                .user(victim)
                .status(StationManagerApplicationStatus.PENDING)
                .build();
        when(applicationRepository.findByApplicationReferenceId("12345678901"))
                .thenReturn(Optional.of(application));
        when(userRepository.findByEmailIgnoreCase(attacker.getEmail())).thenReturn(Optional.of(attacker));

        assertThrows(ResourceNotFoundException.class,
                () -> service.getStatusByReferenceId("12345678901", attacker.getEmail()));
    }

    @Test
    void ownerStatusPayloadContainsNoKycOrBankObject() throws Exception {
        User owner = User.builder().id(1L).email("owner@example.com").role(Role.CUSTOMER).active(true).build();
        StationManagerApplication application = StationManagerApplication.builder()
                .id(9L)
                .applicationReferenceId("12345678901")
                .email(owner.getEmail())
                .user(owner)
                .governmentIdNumber("sensitive-id")
                .bankAccountNumber("sensitive-bank")
                .status(StationManagerApplicationStatus.PENDING)
                .build();
        when(applicationRepository.findByApplicationReferenceId("12345678901"))
                .thenReturn(Optional.of(application));
        when(userRepository.findByEmailIgnoreCase(owner.getEmail())).thenReturn(Optional.of(owner));

        StationManagerStatusLookupResponse response = service.getStatusByReferenceId(
                "12345678901",
                owner.getEmail()
        );
        String json = new ObjectMapper().writeValueAsString(response);

        assertFalse(json.contains("sensitive-id"));
        assertFalse(json.contains("sensitive-bank"));
        assertFalse(json.contains("\"application\":"));
        assertFalse(json.contains("\"reviewNotes\":"));
    }

    @Test
    void submissionRequiresAuthenticatedVerifiedEmail() {
        StationManagerApplicationRequest request = new StationManagerApplicationRequest();
        request.setEmail("victim@example.com");

        assertThrows(BadRequestException.class,
                () -> service.submitApplication(null, request, Map.of(), Map.of()));
        verify(applicationRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void authenticatedCustomerCannotSubmitUsingVictimEmail() {
        User attacker = User.builder().id(2L).email("attacker@example.com").role(Role.CUSTOMER).active(true).build();
        StationManagerApplicationRequest request = new StationManagerApplicationRequest();
        request.setEmail("victim@example.com");
        when(userRepository.findByEmailIgnoreCase(attacker.getEmail())).thenReturn(Optional.of(attacker));
        when(applicationRepository.findByUserId(attacker.getId())).thenReturn(Optional.empty());
        when(applicationRepository.findByEmailIgnoreCase(attacker.getEmail())).thenReturn(Optional.empty());

        assertThrows(BadRequestException.class,
                () -> service.submitApplication(attacker.getEmail(), request, Map.of(), Map.of()));
        verify(applicationRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void rejectsOversizedAdminSearchBeforeRepositoryAccess() {
        assertThrows(BadRequestException.class, () -> service.getAdminApplications(
                PageRequest.of(0, 20), null, "x".repeat(101), false));

        verify(applicationRepository, never()).search(any(), any(), any(Boolean.class), any());
    }

    @Test
    void adminKycDownloadRecordsAuthenticatedActor() {
        StationManagerFileService.DownloadedFile file = new StationManagerFileService.DownloadedFile(
                new byte[] {1, 2, 3}, "document.pdf", "application/pdf");
        when(stationManagerFileService.getStandardFile(
                77L, StationManagerFileSlot.GOVERNMENT_ID_DOCUMENT)).thenReturn(file);

        service.getAdminStandardFile(
                77L, StationManagerFileSlot.GOVERNMENT_ID_DOCUMENT, "admin@example.test");

        verify(auditService).log(
                "DOWNLOAD_KYC_FILE", "STATION_MANAGER_APPLICATION", 77L, "admin@example.test",
                "Downloaded KYC file slot GOVERNMENT_ID_DOCUMENT");
    }

    @Test
    void reviewedApplicationCannotTransitionAgain() {
        StationManagerApplication application = StationManagerApplication.builder()
                .id(88L)
                .status(StationManagerApplicationStatus.APPROVED)
                .build();
        StationManagerReviewRequest request = new StationManagerReviewRequest();
        request.setNotes("reviewed");
        when(applicationRepository.findById(88L)).thenReturn(Optional.of(application));

        assertThrows(BadRequestException.class,
                () -> service.reject(88L, "admin@example.test", request));

        verify(applicationRepository, never()).save(any());
        verify(auditService, never()).log(any(), any(), any(), any(), any());
    }

    @Test
    void completedOperatorAccessCannotBeReissuedThroughApprovalFlow() {
        StationManagerApplication application = StationManagerApplication.builder()
                .id(89L)
                .status(StationManagerApplicationStatus.APPROVED)
                .credentialsIssuedAt(LocalDateTime.now())
                .build();
        StationManagerCredentialIssueRequest request = new StationManagerCredentialIssueRequest();
        request.setPortalLoginEmail("operator@example.test");
        when(applicationRepository.findById(89L)).thenReturn(Optional.of(application));

        assertThrows(BadRequestException.class,
                () -> service.issuePortalCredentials(89L, "admin@example.test", request));

        verify(userRepository, never()).save(any());
        verify(stationManagerAccessSetupService, never()).issueInvitation(any(), any(), any());
    }
}
