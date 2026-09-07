package com.plugin.service;

import com.plugin.dto.request.StationManagerApplicationRequest;
import com.plugin.dto.request.StationManagerCredentialIssueRequest;
import com.plugin.dto.request.StationManagerDocumentRequest;
import com.plugin.dto.request.StationManagerReviewRequest;
import com.plugin.dto.response.AuthResponse;
import com.plugin.dto.response.StationManagerApplicationResponse;
import com.plugin.dto.response.StationManagerApplicationSummaryResponse;
import com.plugin.dto.response.StationManagerBusinessRuleResponse;
import com.plugin.dto.response.StationManagerDocumentResponse;
import com.plugin.dto.response.StationManagerReferenceDataResponse;
import com.plugin.dto.response.StationManagerStatusLookupResponse;
import com.plugin.entity.Station;
import com.plugin.entity.StationManagerApplication;
import com.plugin.entity.StationManagerApplicationDocument;
import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.enums.StationManagerApplicationStatus;
import com.plugin.enums.StationManagerBusinessDocumentType;
import com.plugin.enums.StationManagerBusinessType;
import com.plugin.enums.StationManagerFileSlot;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ConflictException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.StationManagerApplicationRepository;
import com.plugin.repository.StationRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StationManagerApplicationService {

    private final StationManagerApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final StationRepository stationRepository;
    private final AuditService auditService;
    private final AuthService authService;
    private final StationManagerFileService stationManagerFileService;
    private final StationManagerDirectoryService stationManagerDirectoryService;
    private final StationManagerTrackingEmailService stationManagerTrackingEmailService;
    private final StationManagerAccessSetupService stationManagerAccessSetupService;
    private final PasswordEncoder passwordEncoder;

    private static final int APPLICATION_REFERENCE_LENGTH = 11;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private static final EnumMap<StationManagerBusinessType, BusinessRule> BUSINESS_RULES = buildRules();
    private static final Set<StationManagerFileSlot> REQUIRED_STANDARD_FILES = EnumSet.of(
            StationManagerFileSlot.GOVERNMENT_ID_DOCUMENT,
            StationManagerFileSlot.SELFIE_DOCUMENT,
            StationManagerFileSlot.REGISTRATION_PROOF,
            StationManagerFileSlot.AUTHORIZATION_PROOF,
            StationManagerFileSlot.PROPERTY_DOCUMENT,
            StationManagerFileSlot.ELECTRICITY_BILL,
            StationManagerFileSlot.BANK_PROOF,
            StationManagerFileSlot.INSTALLATION_PHOTO,
            StationManagerFileSlot.SITE_PHOTO
    );

    public StationManagerReferenceDataResponse getReferenceData() {
        List<StationManagerBusinessRuleResponse> rules = BUSINESS_RULES.entrySet().stream()
                .map(entry -> StationManagerBusinessRuleResponse.builder()
                        .businessType(entry.getKey())
                        .heading(entry.getValue().heading())
                        .description(entry.getValue().description())
                        .minimumRequiredDocuments(entry.getValue().minimumRequiredDocuments())
                        .requiredDocuments(new ArrayList<>(entry.getValue().requiredDocuments()))
                        .optionalDocuments(new ArrayList<>(entry.getValue().optionalDocuments()))
                        .build())
                .toList();
        return StationManagerReferenceDataResponse.builder()
                .businessRules(rules)
                .build();
    }

    @Transactional
    public StationManagerApplicationResponse getMyApplication(String email) {
        return findAccessibleApplication(email)
                .map(this::ensureApplicationReferenceId)
                .map(this::toResponse)
                .orElse(null);
    }

    public StationManagerStatusLookupResponse getStatusByReferenceId(String referenceId, String authenticatedEmail) {
        StationManagerApplication application = ensureApplicationReferenceId(getApplicationByReferenceId(referenceId));
        User requester = getUserByEmail(authenticatedEmail);
        boolean linkedOwner = application.getUser() != null
                && application.getUser().getId() != null
                && application.getUser().getId().equals(requester.getId());
        boolean originalApplicant = application.getEmail() != null
                && application.getEmail().equalsIgnoreCase(requester.getEmail());
        if (!linkedOwner && !originalApplicant) {
            throw new ResourceNotFoundException("KYC application not found for this tracking ID");
        }
        return StationManagerStatusLookupResponse.builder()
                .applicationReferenceId(application.getApplicationReferenceId())
                .status(application.getStatus())
                .submittedAt(application.getSubmittedAt())
                .reviewedAt(application.getReviewedAt())
                .portalAccessReady(isPortalAccessReady(application))
                .build();
    }

    @Transactional
    public StationManagerApplicationResponse submitApplication(String authenticatedEmail,
                                                              StationManagerApplicationRequest request,
                                                              Map<StationManagerFileSlot, MultipartFile> standardFiles,
                                                              Map<StationManagerBusinessDocumentType, MultipartFile> businessDocumentFiles) {
        if (authenticatedEmail == null || authenticatedEmail.isBlank()) {
            throw new BadRequestException("A verified account is required to submit an application.");
        }
        User requester = getUserByEmail(authenticatedEmail);
        StationManagerApplication application = findOwnedApplication(requester).orElse(null);

        if (application == null) {
            if (requester.getRole() != Role.CUSTOMER) {
                throw new BadRequestException("Only a customer account can create a station manager application.");
            }
            if (!requester.getEmail().equalsIgnoreCase(request.getEmail().trim())) {
                throw new BadRequestException("The application email must match your verified account email.");
            }
            if (applicationRepository.findByEmailIgnoreCase(request.getEmail()).isPresent()) {
                throw new ConflictException("An application already exists for this verified account.");
            }
            application = StationManagerApplication.builder().build();
        } else {
            if (application.getEmail() == null
                    || !application.getEmail().equalsIgnoreCase(request.getEmail().trim())) {
                throw new BadRequestException("The application contact email cannot be changed here.");
            }
            boolean linkedOperator = requester.getRole() == Role.STATION_OPERATOR
                    && application.getUser() != null
                    && requester.getId().equals(application.getUser().getId());
            if (application.getStatus() == StationManagerApplicationStatus.PENDING) {
                throw new ConflictException("This application is already under review.");
            }
            if (application.getStatus() == StationManagerApplicationStatus.APPROVED && !linkedOperator) {
                throw new ConflictException("An approved application cannot be changed through this endpoint.");
            }
        }

        validatePortalEmailAvailability(application, request.getEmail());

        validateRequest(application, request, standardFiles, businessDocumentFiles);

        Map<StationManagerBusinessDocumentType, StationManagerApplicationDocument> existingDocuments = application.getBusinessDocuments().stream()
                .collect(Collectors.toMap(StationManagerApplicationDocument::getDocumentType, document -> document, (left, right) -> left, LinkedHashMap::new));

        applyRequest(application, request);
        syncDocuments(application, request.getBusinessDocuments(), existingDocuments);
        ensureReferencePlaceholders(application, standardFiles, businessDocumentFiles);

        application.setStatus(StationManagerApplicationStatus.PENDING);
        application.setSubmittedAt(LocalDateTime.now());
        application.setReviewedAt(null);
        application.setReviewedBy(null);
        application.setReviewNotes(null);

        application = applicationRepository.save(application);
        application = ensureApplicationReferenceId(application);

        applyUploadedFiles(application, standardFiles, businessDocumentFiles);
        application = applicationRepository.save(application);

        auditService.log("SUBMIT_STATION_MANAGER_APPLICATION", "STATION_MANAGER_APPLICATION", application.getId(), request.getEmail(),
                "Submitted station manager application for business " + application.getBusinessName());

        boolean trackingIdEmailSent = stationManagerTrackingEmailService.sendTrackingId(
                application.getEmail(),
                application.getFullName(),
                application.getApplicationReferenceId(),
                application.getBusinessName(),
                application.getStationName()
        );

        StationManagerApplicationResponse response = toResponse(application);
        response.setTrackingIdEmailSent(trackingIdEmailSent);
        return response;
    }

    public AuthResponse refreshManagerSession(String email) {
        User user = getUserByEmail(email);
        if (user.getRole() != Role.STATION_OPERATOR) {
            throw new BadRequestException("Your station manager application is not approved yet.");
        }
        return authService.issueAuthResponse(user.getEmail());
    }

    public Page<StationManagerApplicationSummaryResponse> getAdminApplications(Pageable pageable,
                                                                               StationManagerApplicationStatus status,
                                                                               String query,
                                                                               boolean linkedStationOnly) {
        String normalizedQuery = normalize(query);
        if (normalizedQuery != null && normalizedQuery.length() > 100) {
            throw new BadRequestException("Application search must not exceed 100 characters");
        }
        if (normalizedQuery != null && normalizedQuery.matches("\\d{11}")) {
            try {
                StationManagerApplication application = getApplicationByReferenceId(normalizedQuery);
                if (status != null && application.getStatus() != status) {
                    return Page.empty(pageable);
                }
                if (linkedStationOnly && application.getApprovedStation() == null) {
                    return Page.empty(pageable);
                }
                StationManagerApplicationSummaryResponse summary = toSummaryResponse(application);
                return new PageImpl<>(List.of(summary), pageable, 1);
            } catch (ResourceNotFoundException ex) {
                return Page.empty(pageable);
            }
        }

        return applicationRepository.search(status, normalizedQuery, linkedStationOnly, pageable)
                .map(this::ensureApplicationReferenceId)
                .map(this::toSummaryResponse);
    }

    public StationManagerApplicationResponse getAdminApplication(Long id) {
        return toResponse(ensureApplicationReferenceId(getApplicationById(id)));
    }

    @Transactional
    public StationManagerApplicationResponse approve(Long id, String actor, StationManagerReviewRequest request) {
        StationManagerApplication application = getApplicationById(id);
        requirePendingReview(application);
        User linkedUser = application.getUser();

        Station station = application.getApprovedStation();
        if (station == null) {
            station = Station.builder()
                    .manager(linkedUser)
                    .active(true)
                    .build();
        }

        station.setManager(linkedUser);
        station.setName(application.getStationName());
        station.setAddress(application.getStationAddress());
        station.setCity(application.getStationCity());
        station.setState(application.getStationState());
        station.setPincode(application.getStationPincode());
        station.setContactPhone(application.getEmergencyContactNumber());
        station.setContactEmail(application.getEmail());
        station.setLatitude(application.getStationLatitude());
        station.setLongitude(application.getStationLongitude());
        station.setOpeningTime(application.getOpeningTime());
        station.setClosingTime(application.getClosingTime());
        station.setActive(true);
        station = stationRepository.save(station);

        application.setApprovedStation(station);
        application.setStatus(StationManagerApplicationStatus.APPROVED);
        application.setReviewedAt(LocalDateTime.now());
        application.setReviewedBy(actor);
        application.setReviewNotes(request.getNotes().trim());
        application = applicationRepository.save(application);
        application = ensureApplicationReferenceId(application);
        stationManagerDirectoryService.upsertFromApplication(application);

        auditService.log("APPROVE_STATION_MANAGER_APPLICATION", "STATION_MANAGER_APPLICATION", application.getId(), actor,
                "Approved station manager application for " + application.getBusinessName());

        return toResponse(application);
    }

    @Transactional
    public StationManagerApplicationResponse reject(Long id, String actor, StationManagerReviewRequest request) {
        StationManagerApplication application = getApplicationById(id);
        requirePendingReview(application);

        application.setStatus(StationManagerApplicationStatus.REJECTED);
        application.setReviewedAt(LocalDateTime.now());
        application.setReviewedBy(actor);
        application.setReviewNotes(request.getNotes().trim());
        application = applicationRepository.save(application);
        application = ensureApplicationReferenceId(application);
        stationManagerDirectoryService.deleteByApplicationId(application.getId());

        auditService.log("REJECT_STATION_MANAGER_APPLICATION", "STATION_MANAGER_APPLICATION", application.getId(), actor,
                "Rejected station manager application for " + application.getBusinessName());

        return toResponse(application);
    }

    @Transactional
    public StationManagerApplicationResponse issuePortalCredentials(Long id,
                                                                   String actor,
                                                                   StationManagerCredentialIssueRequest request) {
        StationManagerApplication application = getApplicationById(id);
        if (application.getStatus() != StationManagerApplicationStatus.APPROVED) {
            throw new BadRequestException("Approve the application before issuing portal credentials.");
        }
        if (application.getCredentialsIssuedAt() != null) {
            throw new BadRequestException("Station manager access has already been configured.");
        }

        String portalEmail = normalizePortalLoginEmail(request.getPortalLoginEmail());
        User linkedUser = application.getUser();
        validatePortalLoginAvailability(linkedUser, portalEmail);

        if (linkedUser == null) {
            linkedUser = User.builder()
                    .fullName(application.getFullName())
                    .email(portalEmail)
                    .phone(application.getPhone())
                    .role(Role.STATION_OPERATOR)
                    .active(false)
                    .build();
        } else {
            linkedUser.setFullName(application.getFullName());
            linkedUser.setEmail(portalEmail);
            linkedUser.setPhone(application.getPhone());
            linkedUser.setRole(Role.STATION_OPERATOR);
            linkedUser.setActive(false);
        }

        linkedUser.setPassword(passwordEncoder.encode(generatePendingAccessSecret()));
        linkedUser.revokeSessions();
        linkedUser = userRepository.save(linkedUser);

        application.setUser(linkedUser);
        application.setCredentialsIssuedAt(null);
        application.setCredentialsIssuedBy(actor);

        Station approvedStation = application.getApprovedStation();
        if (approvedStation == null) {
            approvedStation = Station.builder()
                    .active(true)
                    .build();
        }

        if (approvedStation != null) {
            approvedStation.setManager(linkedUser);
            approvedStation.setName(application.getStationName());
            approvedStation.setAddress(application.getStationAddress());
            approvedStation.setCity(application.getStationCity());
            approvedStation.setState(application.getStationState());
            approvedStation.setPincode(application.getStationPincode());
            approvedStation.setContactPhone(application.getEmergencyContactNumber());
            approvedStation.setContactEmail(application.getEmail());
            approvedStation.setLatitude(application.getStationLatitude());
            approvedStation.setLongitude(application.getStationLongitude());
            approvedStation.setOpeningTime(application.getOpeningTime());
            approvedStation.setClosingTime(application.getClosingTime());
            approvedStation.setActive(true);
            stationRepository.save(approvedStation);
            application.setApprovedStation(approvedStation);
        }

        application = applicationRepository.save(application);
        application = ensureApplicationReferenceId(application);
        stationManagerDirectoryService.upsertFromApplication(application);
        try {
            stationManagerAccessSetupService.issueInvitation(application, linkedUser, actor);
        } catch (IllegalStateException ex) {
            throw new BadRequestException(ex.getMessage());
        }

        auditService.log("ISSUE_STATION_MANAGER_ACCESS_INVITATION", "STATION_MANAGER_APPLICATION", application.getId(), actor,
                "Issued a one-time portal access invitation for " + application.getBusinessName());

        return toResponse(application);
    }

    public StationManagerFileService.DownloadedFile getMyStandardFile(String email, StationManagerFileSlot slotType) {
        StationManagerApplication application = getApplicationForUser(email);
        return stationManagerFileService.getStandardFile(application.getId(), slotType);
    }

    public StationManagerFileService.DownloadedFile getMyBusinessDocumentFile(String email,
                                                                              StationManagerBusinessDocumentType documentType) {
        StationManagerApplication application = getApplicationForUser(email);
        return stationManagerFileService.getBusinessDocumentFile(application.getId(), documentType);
    }

    public StationManagerFileService.DownloadedFile getAdminStandardFile(
            Long applicationId,
            StationManagerFileSlot slotType,
            String actor) {
        StationManagerFileService.DownloadedFile file =
                stationManagerFileService.getStandardFile(applicationId, slotType);
        auditService.log("DOWNLOAD_KYC_FILE", "STATION_MANAGER_APPLICATION", applicationId, actor,
                "Downloaded KYC file slot " + slotType.name());
        return file;
    }

    public StationManagerFileService.DownloadedFile getAdminBusinessDocumentFile(Long applicationId,
                                                                                 StationManagerBusinessDocumentType documentType,
                                                                                 String actor) {
        StationManagerFileService.DownloadedFile file =
                stationManagerFileService.getBusinessDocumentFile(applicationId, documentType);
        auditService.log("DOWNLOAD_KYC_FILE", "STATION_MANAGER_APPLICATION", applicationId, actor,
                "Downloaded KYC business document " + documentType.name());
        return file;
    }

    private void validateRequest(StationManagerApplication application,
                                 StationManagerApplicationRequest request,
                                 Map<StationManagerFileSlot, MultipartFile> standardFiles,
                                 Map<StationManagerBusinessDocumentType, MultipartFile> businessDocumentFiles) {
        if (request.getClosingTime() != null && request.getOpeningTime() != null
                && !request.getClosingTime().isAfter(request.getOpeningTime())) {
            throw new BadRequestException("Closing time must be after opening time.");
        }
        if (request.getNumberOfChargers() != null && request.getNumberOfChargers() <= 0) {
            throw new BadRequestException("Number of chargers must be at least 1.");
        }

        long totalUploadSize = 0L;
        for (MultipartFile file : standardFiles.values()) {
            totalUploadSize = addUploadSize(totalUploadSize, file);
        }
        for (MultipartFile file : businessDocumentFiles.values()) {
            totalUploadSize = addUploadSize(totalUploadSize, file);
        }
        standardFiles.values().forEach(stationManagerFileService::validateUpload);
        businessDocumentFiles.values().forEach(stationManagerFileService::validateUpload);

        validateStandardFiles(application, standardFiles);
        validateBusinessDocuments(application, request.getBusinessType(), request.getBusinessDocuments(), businessDocumentFiles);
    }

    private void requirePendingReview(StationManagerApplication application) {
        if (application.getStatus() != StationManagerApplicationStatus.PENDING) {
            throw new BadRequestException("This station manager application has already been reviewed.");
        }
    }

    private void validatePortalEmailAvailability(StationManagerApplication application, String email) {
        String normalizedEmail = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            return;
        }

        userRepository.findByEmailIgnoreCase(normalizedEmail).ifPresent(existingUser -> {
            if (application.getUser() == null || !existingUser.getId().equals(application.getUser().getId())) {
                throw new BadRequestException("This email is already in use for a portal account. Please use a different email.");
            }
        });
    }

    private void validatePortalLoginAvailability(User linkedUser, String portalLoginEmail) {
        userRepository.findByEmailIgnoreCase(portalLoginEmail).ifPresent(existingUser -> {
            if (linkedUser == null || !existingUser.getId().equals(linkedUser.getId())) {
                throw new BadRequestException("This portal login email is already in use.");
            }
        });
    }

    private void validateStandardFiles(StationManagerApplication application,
                                       Map<StationManagerFileSlot, MultipartFile> standardFiles) {
        for (StationManagerFileSlot slotType : REQUIRED_STANDARD_FILES) {
            boolean hasNewFile = hasUploadedFile(standardFiles.get(slotType));
            boolean hasExistingFile = application.getId() != null
                    && stationManagerFileService.hasStandardFile(application.getId(), slotType);
            if (!hasNewFile && !hasExistingFile) {
                throw new BadRequestException("Please upload " + humanize(slotType));
            }
        }
    }

    private void validateBusinessDocuments(StationManagerApplication application,
                                           StationManagerBusinessType businessType,
                                           List<StationManagerDocumentRequest> documents,
                                           Map<StationManagerBusinessDocumentType, MultipartFile> businessDocumentFiles) {
        BusinessRule rule = BUSINESS_RULES.get(businessType);
        if (rule == null) {
            throw new BadRequestException("Unsupported business type.");
        }

        List<StationManagerDocumentRequest> safeDocuments = documents == null ? List.of() : documents;
        EnumMap<StationManagerBusinessDocumentType, StationManagerDocumentRequest> byType = new EnumMap<>(StationManagerBusinessDocumentType.class);
        for (StationManagerDocumentRequest document : safeDocuments) {
            if (document == null || document.getDocumentType() == null) {
                throw new BadRequestException("Each business document must include a document type.");
            }
            if (byType.put(document.getDocumentType(), document) != null) {
                throw new BadRequestException("Duplicate business document: " + document.getDocumentType());
            }
        }

        Set<StationManagerBusinessDocumentType> providedTypes = byType.keySet();
        Set<StationManagerBusinessDocumentType> allowed = rule.allowedDocuments();
        for (StationManagerBusinessDocumentType type : providedTypes) {
            if (!allowed.contains(type)) {
                throw new BadRequestException("Document " + type + " is not valid for business type " + businessType + ".");
            }
            boolean hasNewFile = hasUploadedFile(businessDocumentFiles.get(type));
            boolean hasExistingFile = application.getId() != null
                    && stationManagerFileService.hasBusinessDocumentFile(application.getId(), type);
            if (!hasNewFile && !hasExistingFile) {
                throw new BadRequestException("Please upload the file for " + humanize(type));
            }
        }

        for (StationManagerBusinessDocumentType required : rule.requiredDocuments()) {
            if (!providedTypes.contains(required)) {
                throw new BadRequestException("Missing required business document: " + humanize(required));
            }
        }

        if (rule.minimumRequiredDocuments() > 0 && providedTypes.size() < rule.minimumRequiredDocuments()) {
            throw new BadRequestException("Please provide at least " + rule.minimumRequiredDocuments()
                    + " business document(s) for " + humanize(businessType.name()) + ".");
        }
    }

    private void applyRequest(StationManagerApplication application, StationManagerApplicationRequest request) {
        application.setFullName(request.getFullName().trim());
        application.setEmail(request.getEmail().trim().toLowerCase(Locale.ROOT));
        application.setPhone(request.getPhone().trim());
        application.setDateOfBirth(request.getDateOfBirth());
        application.setResidentialAddress(request.getResidentialAddress().trim());
        application.setGovernmentIdType(request.getGovernmentIdType().trim());
        application.setGovernmentIdNumber(request.getGovernmentIdNumber().trim());
        application.setBusinessType(request.getBusinessType());
        application.setBusinessName(request.getBusinessName().trim());
        application.setLegalBusinessName(request.getLegalBusinessName().trim());
        application.setPanNumber(request.getPanNumber().trim().toUpperCase(Locale.ROOT));
        application.setGstNumber(normalize(request.getGstNumber()));
        application.setBusinessRegistrationNumber(normalize(request.getBusinessRegistrationNumber()));
        application.setBusinessAddress(request.getBusinessAddress().trim());
        application.setAuthorizedSignatoryName(request.getAuthorizedSignatoryName().trim());
        application.setAuthorizedSignatoryDesignation(request.getAuthorizedSignatoryDesignation().trim());
        application.setStationName(request.getStationName().trim());
        application.setStationAddress(request.getStationAddress().trim());
        application.setStationCity(request.getStationCity().trim());
        application.setStationState(request.getStationState().trim());
        application.setStationPincode(request.getStationPincode().trim());
        application.setStationLatitude(request.getStationLatitude());
        application.setStationLongitude(request.getStationLongitude());
        application.setPropertyOccupancyType(request.getPropertyOccupancyType());
        application.setElectricityConsumerNumber(request.getElectricityConsumerNumber().trim());
        application.setOpeningTime(request.getOpeningTime());
        application.setClosingTime(request.getClosingTime());
        application.setEmergencyContactNumber(request.getEmergencyContactNumber().trim());
        application.setBankAccountHolderName(request.getBankAccountHolderName().trim());
        application.setBankName(request.getBankName().trim());
        application.setBankAccountNumber(request.getBankAccountNumber().trim());
        application.setBankIfscCode(request.getBankIfscCode().trim().toUpperCase(Locale.ROOT));
        application.setNumberOfChargers(request.getNumberOfChargers());
        application.setChargerTypesSummary(request.getChargerTypesSummary().trim());
        application.setConnectorTypesSummary(request.getConnectorTypesSummary().trim());
        application.setTotalCapacityKw(request.getTotalCapacityKw());
        application.setChargerManufacturerNames(request.getChargerManufacturerNames().trim());
    }

    private void syncDocuments(StationManagerApplication application,
                               List<StationManagerDocumentRequest> requestDocuments,
                               Map<StationManagerBusinessDocumentType, StationManagerApplicationDocument> existingDocuments) {
        application.getBusinessDocuments().clear();
        List<StationManagerDocumentRequest> safeDocuments = requestDocuments == null ? List.of() : requestDocuments;
        for (StationManagerDocumentRequest requestDocument : safeDocuments) {
            StationManagerApplicationDocument existing = existingDocuments.get(requestDocument.getDocumentType());
            StationManagerApplicationDocument document = StationManagerApplicationDocument.builder()
                    .application(application)
                    .documentType(requestDocument.getDocumentType())
                    .referenceNumber(normalize(requestDocument.getReferenceNumber()))
                    .documentReference(existing != null ? existing.getDocumentReference() : requestDocument.getDocumentType().name())
                    .notes(normalize(requestDocument.getNotes()))
                    .build();
            application.getBusinessDocuments().add(document);
        }
    }

    private void ensureReferencePlaceholders(StationManagerApplication application,
                                             Map<StationManagerFileSlot, MultipartFile> standardFiles,
                                             Map<StationManagerBusinessDocumentType, MultipartFile> businessDocumentFiles) {
        application.setGovernmentIdDocumentReference(resolveReferencePlaceholder(
                application.getGovernmentIdDocumentReference(),
                hasUploadedFile(standardFiles.get(StationManagerFileSlot.GOVERNMENT_ID_DOCUMENT)),
                StationManagerFileSlot.GOVERNMENT_ID_DOCUMENT.name()
        ));
        application.setSelfieDocumentReference(resolveReferencePlaceholder(
                application.getSelfieDocumentReference(),
                hasUploadedFile(standardFiles.get(StationManagerFileSlot.SELFIE_DOCUMENT)),
                StationManagerFileSlot.SELFIE_DOCUMENT.name()
        ));
        application.setRegistrationProofReference(resolveReferencePlaceholder(
                application.getRegistrationProofReference(),
                hasUploadedFile(standardFiles.get(StationManagerFileSlot.REGISTRATION_PROOF)),
                StationManagerFileSlot.REGISTRATION_PROOF.name()
        ));
        application.setAuthorizationProofReference(resolveReferencePlaceholder(
                application.getAuthorizationProofReference(),
                hasUploadedFile(standardFiles.get(StationManagerFileSlot.AUTHORIZATION_PROOF)),
                StationManagerFileSlot.AUTHORIZATION_PROOF.name()
        ));
        application.setPropertyDocumentReference(resolveReferencePlaceholder(
                application.getPropertyDocumentReference(),
                hasUploadedFile(standardFiles.get(StationManagerFileSlot.PROPERTY_DOCUMENT)),
                StationManagerFileSlot.PROPERTY_DOCUMENT.name()
        ));
        application.setElectricityBillReference(resolveReferencePlaceholder(
                application.getElectricityBillReference(),
                hasUploadedFile(standardFiles.get(StationManagerFileSlot.ELECTRICITY_BILL)),
                StationManagerFileSlot.ELECTRICITY_BILL.name()
        ));
        application.setBankProofReference(resolveReferencePlaceholder(
                application.getBankProofReference(),
                hasUploadedFile(standardFiles.get(StationManagerFileSlot.BANK_PROOF)),
                StationManagerFileSlot.BANK_PROOF.name()
        ));
        application.setInstallationPhotoReference(resolveReferencePlaceholder(
                application.getInstallationPhotoReference(),
                hasUploadedFile(standardFiles.get(StationManagerFileSlot.INSTALLATION_PHOTO)),
                StationManagerFileSlot.INSTALLATION_PHOTO.name()
        ));
        application.setSitePhotoReference(resolveReferencePlaceholder(
                application.getSitePhotoReference(),
                hasUploadedFile(standardFiles.get(StationManagerFileSlot.SITE_PHOTO)),
                StationManagerFileSlot.SITE_PHOTO.name()
        ));

        for (StationManagerApplicationDocument document : application.getBusinessDocuments()) {
            document.setDocumentReference(resolveReferencePlaceholder(
                    document.getDocumentReference(),
                    hasUploadedFile(businessDocumentFiles.get(document.getDocumentType())),
                    document.getDocumentType().name()
            ));
        }
    }

    private String resolveReferencePlaceholder(String currentValue, boolean hasUploadedFile, String placeholder) {
        if (!isBlank(currentValue)) {
            return currentValue;
        }
        return hasUploadedFile ? placeholder : currentValue;
    }

    private void applyUploadedFiles(StationManagerApplication application,
                                    Map<StationManagerFileSlot, MultipartFile> standardFiles,
                                    Map<StationManagerBusinessDocumentType, MultipartFile> businessDocumentFiles) {
        application.setGovernmentIdDocumentReference(resolveStandardFileName(application, StationManagerFileSlot.GOVERNMENT_ID_DOCUMENT, standardFiles));
        application.setSelfieDocumentReference(resolveStandardFileName(application, StationManagerFileSlot.SELFIE_DOCUMENT, standardFiles));
        application.setRegistrationProofReference(resolveStandardFileName(application, StationManagerFileSlot.REGISTRATION_PROOF, standardFiles));
        application.setAuthorizationProofReference(resolveStandardFileName(application, StationManagerFileSlot.AUTHORIZATION_PROOF, standardFiles));
        application.setPropertyDocumentReference(resolveStandardFileName(application, StationManagerFileSlot.PROPERTY_DOCUMENT, standardFiles));
        application.setElectricityBillReference(resolveStandardFileName(application, StationManagerFileSlot.ELECTRICITY_BILL, standardFiles));
        application.setBankProofReference(resolveStandardFileName(application, StationManagerFileSlot.BANK_PROOF, standardFiles));
        application.setInstallationPhotoReference(resolveStandardFileName(application, StationManagerFileSlot.INSTALLATION_PHOTO, standardFiles));
        application.setSitePhotoReference(resolveStandardFileName(application, StationManagerFileSlot.SITE_PHOTO, standardFiles));

        Set<StationManagerBusinessDocumentType> activeTypes = application.getBusinessDocuments().stream()
                .map(StationManagerApplicationDocument::getDocumentType)
                .collect(Collectors.toSet());
        stationManagerFileService.deleteMissingBusinessDocumentFiles(application.getId(), activeTypes);

        for (StationManagerApplicationDocument document : application.getBusinessDocuments()) {
            String uploadedFileName = stationManagerFileService.upsertBusinessDocumentFile(
                    application,
                    document.getDocumentType(),
                    businessDocumentFiles.get(document.getDocumentType())
            );
            if (uploadedFileName != null) {
                document.setDocumentReference(uploadedFileName);
            }
        }
    }

    private String resolveStandardFileName(StationManagerApplication application,
                                           StationManagerFileSlot slotType,
                                           Map<StationManagerFileSlot, MultipartFile> standardFiles) {
        String uploadedFileName = stationManagerFileService.upsertStandardFile(application, slotType, standardFiles.get(slotType));
        if (uploadedFileName != null) {
            return uploadedFileName;
        }
        return getExistingStandardReference(application, slotType);
    }

    private String getExistingStandardReference(StationManagerApplication application, StationManagerFileSlot slotType) {
        return switch (slotType) {
            case GOVERNMENT_ID_DOCUMENT -> application.getGovernmentIdDocumentReference();
            case SELFIE_DOCUMENT -> application.getSelfieDocumentReference();
            case REGISTRATION_PROOF -> application.getRegistrationProofReference();
            case AUTHORIZATION_PROOF -> application.getAuthorizationProofReference();
            case PROPERTY_DOCUMENT -> application.getPropertyDocumentReference();
            case ELECTRICITY_BILL -> application.getElectricityBillReference();
            case BANK_PROOF -> application.getBankProofReference();
            case INSTALLATION_PHOTO -> application.getInstallationPhotoReference();
            case SITE_PHOTO -> application.getSitePhotoReference();
            case BUSINESS_DOCUMENT -> null;
        };
    }

    private StationManagerApplicationSummaryResponse toSummaryResponse(StationManagerApplication application) {
        return StationManagerApplicationSummaryResponse.builder()
                .id(application.getId())
                .userId(application.getUser() != null ? application.getUser().getId() : null)
                .approvedStationId(application.getApprovedStation() != null ? application.getApprovedStation().getId() : null)
                .applicationReferenceId(application.getApplicationReferenceId())
                .fullName(application.getFullName())
                .email(application.getEmail())
                .phone(application.getPhone())
                .businessType(application.getBusinessType())
                .businessName(application.getBusinessName())
                .stationName(application.getStationName())
                .stationCity(application.getStationCity())
                .stationState(application.getStationState())
                .status(application.getStatus())
                .portalAccessReady(isPortalAccessReady(application))
                .submittedAt(application.getSubmittedAt())
                .reviewedAt(application.getReviewedAt())
                .reviewedBy(application.getReviewedBy())
                .reviewNotes(application.getReviewNotes())
                .build();
    }

    private StationManagerApplicationResponse toResponse(StationManagerApplication application) {
        List<StationManagerDocumentResponse> documents = application.getBusinessDocuments().stream()
                .sorted(Comparator.comparing(doc -> doc.getDocumentType().name()))
                .map(document -> StationManagerDocumentResponse.builder()
                        .id(document.getId())
                        .documentType(document.getDocumentType())
                        .referenceNumber(document.getReferenceNumber())
                        .documentReference(document.getDocumentReference())
                        .notes(document.getNotes())
                        .build())
                .toList();

        return StationManagerApplicationResponse.builder()
                .id(application.getId())
                .userId(application.getUser() != null ? application.getUser().getId() : null)
                .approvedStationId(application.getApprovedStation() != null ? application.getApprovedStation().getId() : null)
                .applicationReferenceId(application.getApplicationReferenceId())
                .status(application.getStatus())
                .fullName(application.getFullName())
                .email(application.getEmail())
                .phone(application.getPhone())
                .dateOfBirth(application.getDateOfBirth())
                .residentialAddress(application.getResidentialAddress())
                .governmentIdType(application.getGovernmentIdType())
                .governmentIdNumber(application.getGovernmentIdNumber())
                .governmentIdDocumentReference(application.getGovernmentIdDocumentReference())
                .selfieDocumentReference(application.getSelfieDocumentReference())
                .businessType(application.getBusinessType())
                .businessName(application.getBusinessName())
                .legalBusinessName(application.getLegalBusinessName())
                .panNumber(application.getPanNumber())
                .gstNumber(application.getGstNumber())
                .businessRegistrationNumber(application.getBusinessRegistrationNumber())
                .businessAddress(application.getBusinessAddress())
                .authorizedSignatoryName(application.getAuthorizedSignatoryName())
                .authorizedSignatoryDesignation(application.getAuthorizedSignatoryDesignation())
                .registrationProofReference(application.getRegistrationProofReference())
                .authorizationProofReference(application.getAuthorizationProofReference())
                .businessDocuments(documents)
                .stationName(application.getStationName())
                .stationAddress(application.getStationAddress())
                .stationCity(application.getStationCity())
                .stationState(application.getStationState())
                .stationPincode(application.getStationPincode())
                .stationLatitude(application.getStationLatitude())
                .stationLongitude(application.getStationLongitude())
                .propertyOccupancyType(application.getPropertyOccupancyType())
                .propertyDocumentReference(application.getPropertyDocumentReference())
                .electricityConsumerNumber(application.getElectricityConsumerNumber())
                .electricityBillReference(application.getElectricityBillReference())
                .openingTime(application.getOpeningTime())
                .closingTime(application.getClosingTime())
                .emergencyContactNumber(application.getEmergencyContactNumber())
                .bankAccountHolderName(application.getBankAccountHolderName())
                .bankName(application.getBankName())
                .bankAccountNumber(application.getBankAccountNumber())
                .bankIfscCode(application.getBankIfscCode())
                .bankProofReference(application.getBankProofReference())
                .numberOfChargers(application.getNumberOfChargers())
                .chargerTypesSummary(application.getChargerTypesSummary())
                .connectorTypesSummary(application.getConnectorTypesSummary())
                .totalCapacityKw(application.getTotalCapacityKw())
                .chargerManufacturerNames(application.getChargerManufacturerNames())
                .installationPhotoReference(application.getInstallationPhotoReference())
                .sitePhotoReference(application.getSitePhotoReference())
                .submittedAt(application.getSubmittedAt())
                .reviewedAt(application.getReviewedAt())
                .reviewedBy(application.getReviewedBy())
                .reviewNotes(application.getReviewNotes())
                .portalAccessReady(isPortalAccessReady(application))
                .portalLoginEmail(application.getUser() != null ? application.getUser().getEmail() : null)
                .credentialsIssuedAt(application.getCredentialsIssuedAt())
                .credentialsIssuedBy(application.getCredentialsIssuedBy())
                .createdAt(application.getCreatedAt())
                .updatedAt(application.getUpdatedAt())
                .build();
    }

    private StationManagerApplication getApplicationForUser(String email) {
        User user = getUserByEmail(email);
        return applicationRepository.findByUserId(user.getId())
                .or(() -> applicationRepository.findByEmailIgnoreCase(user.getEmail()))
                .orElseThrow(() -> new ResourceNotFoundException("Station manager application not found"));
    }

    private Optional<StationManagerApplication> findAccessibleApplication(String email) {
        String normalizedEmail = normalize(email);
        if (normalizedEmail == null) {
            return Optional.empty();
        }

        Optional<StationManagerApplication> byLinkedUser = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .flatMap(user -> applicationRepository.findByUserId(user.getId())
                        .or(() -> applicationRepository.findByEmailIgnoreCase(user.getEmail())));

        return byLinkedUser.isPresent() ? byLinkedUser : applicationRepository.findByEmailIgnoreCase(normalizedEmail);
    }

    private Optional<StationManagerApplication> findOwnedApplication(User user) {
        if (user == null || user.getId() == null) {
            return Optional.empty();
        }
        return applicationRepository.findByUserId(user.getId())
                .or(() -> applicationRepository.findByEmailIgnoreCase(user.getEmail()));
    }

    private StationManagerApplication getApplicationByReferenceId(String referenceId) {
        String normalizedReferenceId = normalizeReferenceId(referenceId);

        return applicationRepository.findByApplicationReferenceId(normalizedReferenceId)
                .map(this::ensureApplicationReferenceId)
                .orElseThrow(() -> new ResourceNotFoundException("KYC application not found for this tracking ID"));
    }

    private StationManagerApplication getApplicationById(Long id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Station manager application not found"));
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private boolean hasUploadedFile(MultipartFile file) {
        return file != null && !file.isEmpty();
    }

    private long addUploadSize(long currentTotal, MultipartFile file) {
        if (!hasUploadedFile(file)) {
            return currentTotal;
        }
        long size = file.getSize();
        if (size <= 0
                || size > StationManagerFileService.MAX_FILE_SIZE_BYTES
                || currentTotal > StationManagerFileService.MAX_TOTAL_UPLOAD_SIZE_BYTES - size) {
            throw new BadRequestException("Each file must be 10 MB or smaller and total uploads must be 50 MB or smaller.");
        }
        return currentTotal + size;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String normalizeReferenceId(String value) {
        String normalized = value == null ? "" : value.trim();
        if (!normalized.matches("\\d{" + APPLICATION_REFERENCE_LENGTH + "}")) {
            throw new BadRequestException("Enter a valid 11-digit KYC tracking ID.");
        }
        return normalized;
    }

    private String normalizePortalLoginEmail(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            throw new BadRequestException("Portal login email is required.");
        }
        if (!normalized.endsWith("@plugin.com")) {
            throw new BadRequestException("Portal login email must end with @plugin.com.");
        }
        return normalized;
    }

    private boolean isPortalAccessReady(StationManagerApplication application) {
        return application.getUser() != null
                && Boolean.TRUE.equals(application.getUser().getActive())
                && application.getCredentialsIssuedAt() != null;
    }

    private String generatePendingAccessSecret() {
        byte[] random = new byte[32];
        SECURE_RANDOM.nextBytes(random);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(random);
    }

    private StationManagerApplication ensureApplicationReferenceId(StationManagerApplication application) {
        if (application == null || !isBlank(application.getApplicationReferenceId())) {
            return application;
        }

        application.setApplicationReferenceId(generateUniqueApplicationReferenceId());
        return applicationRepository.save(application);
    }

    private String generateUniqueApplicationReferenceId() {
        for (int attempt = 0; attempt < 32; attempt += 1) {
            String candidate = generateApplicationReferenceCandidate();
            if (!applicationRepository.existsByApplicationReferenceId(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Unable to generate a unique KYC tracking ID.");
    }

    private String generateApplicationReferenceCandidate() {
        StringBuilder builder = new StringBuilder(APPLICATION_REFERENCE_LENGTH);
        builder.append(SECURE_RANDOM.nextInt(9) + 1);
        for (int index = 1; index < APPLICATION_REFERENCE_LENGTH; index += 1) {
            builder.append(SECURE_RANDOM.nextInt(10));
        }
        return builder.toString();
    }

    private String humanize(Enum<?> value) {
        return humanize(value.name());
    }

    private String humanize(String value) {
        return Arrays.stream(value.split("_"))
                .map(part -> part.substring(0, 1) + part.substring(1).toLowerCase(Locale.ROOT))
                .collect(Collectors.joining(" "));
    }

    private static EnumMap<StationManagerBusinessType, BusinessRule> buildRules() {
        EnumMap<StationManagerBusinessType, BusinessRule> rules = new EnumMap<>(StationManagerBusinessType.class);
        rules.put(StationManagerBusinessType.INDIVIDUAL, new BusinessRule(
                "Individual operator",
                "Personal operator applying in their own name.",
                1,
                EnumSet.of(StationManagerBusinessDocumentType.INDIVIDUAL_ID_PROOF),
                EnumSet.noneOf(StationManagerBusinessDocumentType.class)
        ));
        rules.put(StationManagerBusinessType.PROPRIETORSHIP, new BusinessRule(
                "Sole proprietorship",
                "Provide any two business proofs for the proprietorship.",
                2,
                EnumSet.noneOf(StationManagerBusinessDocumentType.class),
                EnumSet.of(
                        StationManagerBusinessDocumentType.PROPRIETORSHIP_REGISTRATION_PROOF,
                        StationManagerBusinessDocumentType.UDYAM_REGISTRATION,
                        StationManagerBusinessDocumentType.SHOP_ESTABLISHMENT_LICENSE,
                        StationManagerBusinessDocumentType.GST_CERTIFICATE
                )
        ));
        rules.put(StationManagerBusinessType.PARTNERSHIP, new BusinessRule(
                "Partnership firm",
                "Partnership registration and deed are required.",
                2,
                EnumSet.of(
                        StationManagerBusinessDocumentType.PARTNERSHIP_REGISTRATION_CERTIFICATE,
                        StationManagerBusinessDocumentType.PARTNERSHIP_DEED
                ),
                EnumSet.of(StationManagerBusinessDocumentType.AUTHORIZATION_LETTER)
        ));
        rules.put(StationManagerBusinessType.LLP, new BusinessRule(
                "Limited liability partnership",
                "LLP incorporation proof and LLP agreement are required.",
                2,
                EnumSet.of(
                        StationManagerBusinessDocumentType.LLP_CERTIFICATE_OF_INCORPORATION,
                        StationManagerBusinessDocumentType.LLP_AGREEMENT
                ),
                EnumSet.of(StationManagerBusinessDocumentType.AUTHORIZATION_LETTER)
        ));
        rules.put(StationManagerBusinessType.COMPANY, new BusinessRule(
                "Company",
                "Company incorporation documents and board resolution are required.",
                4,
                EnumSet.of(
                        StationManagerBusinessDocumentType.COMPANY_CERTIFICATE_OF_INCORPORATION,
                        StationManagerBusinessDocumentType.MEMORANDUM_OF_ASSOCIATION,
                        StationManagerBusinessDocumentType.ARTICLES_OF_ASSOCIATION,
                        StationManagerBusinessDocumentType.BOARD_RESOLUTION
                ),
                EnumSet.of(StationManagerBusinessDocumentType.AUTHORIZATION_LETTER)
        ));
        return rules;
    }

    private record BusinessRule(String heading,
                                String description,
                                int minimumRequiredDocuments,
                                Set<StationManagerBusinessDocumentType> requiredDocuments,
                                Set<StationManagerBusinessDocumentType> optionalDocuments) {
        private Set<StationManagerBusinessDocumentType> allowedDocuments() {
            EnumSet<StationManagerBusinessDocumentType> allowed = EnumSet.noneOf(StationManagerBusinessDocumentType.class);
            allowed.addAll(requiredDocuments);
            allowed.addAll(optionalDocuments);
            return allowed;
        }
    }
}
