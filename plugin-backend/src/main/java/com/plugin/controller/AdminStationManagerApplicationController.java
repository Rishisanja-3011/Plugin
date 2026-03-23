package com.plugin.controller;

import com.plugin.dto.request.StationManagerCredentialIssueRequest;
import com.plugin.dto.request.StationManagerReviewRequest;
import com.plugin.dto.response.StationManagerApplicationResponse;
import com.plugin.dto.response.StationManagerApplicationSummaryResponse;
import com.plugin.enums.StationManagerApplicationStatus;
import com.plugin.enums.StationManagerBusinessDocumentType;
import com.plugin.enums.StationManagerFileSlot;
import com.plugin.service.StationManagerApplicationService;
import com.plugin.service.StationManagerFileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/station-manager-applications")
@RequiredArgsConstructor
public class AdminStationManagerApplicationController {

    private final StationManagerApplicationService stationManagerApplicationService;

    @GetMapping
    public ResponseEntity<Page<StationManagerApplicationSummaryResponse>> getApplications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) StationManagerApplicationStatus status,
            @RequestParam(defaultValue = "false") boolean linkedStationOnly,
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(stationManagerApplicationService.getAdminApplications(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "submittedAt")),
                status,
                q,
                linkedStationOnly
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StationManagerApplicationResponse> getApplication(@PathVariable Long id) {
        return ResponseEntity.ok(stationManagerApplicationService.getAdminApplication(id));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<StationManagerApplicationResponse> approve(
            @PathVariable Long id,
            @Valid @RequestBody StationManagerReviewRequest request,
            Authentication auth) {
        return ResponseEntity.ok(stationManagerApplicationService.approve(id, auth.getName(), request));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<StationManagerApplicationResponse> reject(
            @PathVariable Long id,
            @Valid @RequestBody StationManagerReviewRequest request,
            Authentication auth) {
        return ResponseEntity.ok(stationManagerApplicationService.reject(id, auth.getName(), request));
    }

    @PostMapping("/{id}/issue-credentials")
    public ResponseEntity<StationManagerApplicationResponse> issueCredentials(@PathVariable Long id,
                                                                              @Valid @RequestBody StationManagerCredentialIssueRequest request,
                                                                              Authentication auth) {
        return ResponseEntity.ok(stationManagerApplicationService.issuePortalCredentials(id, auth.getName(), request));
    }

    @GetMapping("/{id}/files/{slotType}")
    public ResponseEntity<byte[]> downloadStandardFile(@PathVariable Long id,
                                                       @PathVariable StationManagerFileSlot slotType) {
        return buildFileResponse(stationManagerApplicationService.getAdminStandardFile(id, slotType));
    }

    @GetMapping("/{id}/business-documents/{documentType}/file")
    public ResponseEntity<byte[]> downloadBusinessDocumentFile(@PathVariable Long id,
                                                               @PathVariable StationManagerBusinessDocumentType documentType) {
        return buildFileResponse(stationManagerApplicationService.getAdminBusinessDocumentFile(id, documentType));
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
