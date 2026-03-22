package com.plugin.controller;

import com.plugin.dto.request.StationManagerApplicationRequest;
import com.plugin.dto.response.AuthResponse;
import com.plugin.dto.response.StationManagerApplicationResponse;
import com.plugin.dto.response.StationManagerReferenceDataResponse;
import com.plugin.dto.response.StationManagerStatusLookupResponse;
import com.plugin.enums.StationManagerBusinessDocumentType;
import com.plugin.enums.StationManagerFileSlot;
import com.plugin.service.StationManagerApplicationService;
import com.plugin.service.StationManagerFileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import java.util.EnumMap;
import java.util.Map;

@RestController
@RequestMapping("/api/station-manager")
@RequiredArgsConstructor
public class StationManagerApplicationController {

    private final StationManagerApplicationService stationManagerApplicationService;

    @GetMapping("/reference-data")
    public ResponseEntity<StationManagerReferenceDataResponse> getReferenceData() {
        return ResponseEntity.ok(stationManagerApplicationService.getReferenceData());
    }

    @GetMapping("/status/{referenceId}")
    public ResponseEntity<StationManagerStatusLookupResponse> getApplicationStatus(@PathVariable String referenceId) {
        return ResponseEntity.ok(stationManagerApplicationService.getStatusByReferenceId(referenceId));
    }

    @GetMapping("/application")
    public ResponseEntity<StationManagerApplicationResponse> getMyApplication(Authentication auth) {
        return ResponseEntity.ok(stationManagerApplicationService.getMyApplication(auth.getName()));
    }

    @PostMapping(value = "/application", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<StationManagerApplicationResponse> submitApplication(
            @Valid @RequestPart("application") StationManagerApplicationRequest request,
            MultipartHttpServletRequest multipartRequest) {
        return ResponseEntity.ok(stationManagerApplicationService.submitApplication(
                request,
                extractStandardFiles(multipartRequest),
                extractBusinessDocumentFiles(multipartRequest)
        ));
    }

    @PostMapping("/session")
    public ResponseEntity<AuthResponse> refreshManagerSession(Authentication auth) {
        return ResponseEntity.ok(stationManagerApplicationService.refreshManagerSession(auth.getName()));
    }

    @GetMapping("/application/files/{slotType}")
    public ResponseEntity<byte[]> downloadMyFile(@PathVariable StationManagerFileSlot slotType, Authentication auth) {
        return buildFileResponse(stationManagerApplicationService.getMyStandardFile(auth.getName(), slotType));
    }

    @GetMapping("/application/business-documents/{documentType}/file")
    public ResponseEntity<byte[]> downloadMyBusinessDocument(@PathVariable StationManagerBusinessDocumentType documentType,
                                                             Authentication auth) {
        return buildFileResponse(stationManagerApplicationService.getMyBusinessDocumentFile(auth.getName(), documentType));
    }

    private EnumMap<StationManagerFileSlot, MultipartFile> extractStandardFiles(MultipartHttpServletRequest request) {
        EnumMap<StationManagerFileSlot, MultipartFile> files = new EnumMap<>(StationManagerFileSlot.class);
        putIfPresent(files, StationManagerFileSlot.GOVERNMENT_ID_DOCUMENT, request.getFile("governmentIdDocument"));
        putIfPresent(files, StationManagerFileSlot.SELFIE_DOCUMENT, request.getFile("selfieDocument"));
        putIfPresent(files, StationManagerFileSlot.REGISTRATION_PROOF, request.getFile("registrationProof"));
        putIfPresent(files, StationManagerFileSlot.AUTHORIZATION_PROOF, request.getFile("authorizationProof"));
        putIfPresent(files, StationManagerFileSlot.PROPERTY_DOCUMENT, request.getFile("propertyDocument"));
        putIfPresent(files, StationManagerFileSlot.ELECTRICITY_BILL, request.getFile("electricityBill"));
        putIfPresent(files, StationManagerFileSlot.BANK_PROOF, request.getFile("bankProof"));
        putIfPresent(files, StationManagerFileSlot.INSTALLATION_PHOTO, request.getFile("installationPhoto"));
        putIfPresent(files, StationManagerFileSlot.SITE_PHOTO, request.getFile("sitePhoto"));
        return files;
    }

    private EnumMap<StationManagerBusinessDocumentType, MultipartFile> extractBusinessDocumentFiles(MultipartHttpServletRequest request) {
        EnumMap<StationManagerBusinessDocumentType, MultipartFile> files = new EnumMap<>(StationManagerBusinessDocumentType.class);
        for (Map.Entry<String, MultipartFile> entry : request.getFileMap().entrySet()) {
            String key = entry.getKey();
            if (!key.startsWith("businessDocumentFiles.")) {
                continue;
            }
            String rawType = key.substring("businessDocumentFiles.".length());
            StationManagerBusinessDocumentType documentType = StationManagerBusinessDocumentType.valueOf(rawType);
            putIfPresent(files, documentType, entry.getValue());
        }
        return files;
    }

    private <K> void putIfPresent(Map<K, MultipartFile> target, K key, MultipartFile file) {
        if (file != null && !file.isEmpty()) {
            target.put(key, file);
        }
    }

    private ResponseEntity<byte[]> buildFileResponse(StationManagerFileService.DownloadedFile file) {
        MediaType mediaType = file.contentType() != null && !file.contentType().isBlank()
                ? MediaType.parseMediaType(file.contentType())
                : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.fileName() + "\"")
                .body(file.data());
    }
}
