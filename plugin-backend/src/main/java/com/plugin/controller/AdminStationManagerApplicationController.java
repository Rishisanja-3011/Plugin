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
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;

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
        int safeSize = Math.max(1, Math.min(size, 100));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(stationManagerApplicationService.getAdminApplications(
                        PageRequest.of(Math.max(page, 0), safeSize, Sort.by(Sort.Direction.DESC, "submittedAt")),
                        status,
                        q,
                        linkedStationOnly
                ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StationManagerApplicationResponse> getApplication(@PathVariable Long id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(stationManagerApplicationService.getAdminApplication(id));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<StationManagerApplicationResponse> approve(
            @PathVariable Long id,
            @Valid @RequestBody StationManagerReviewRequest request,
            Authentication auth) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(stationManagerApplicationService.approve(id, auth.getName(), request));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<StationManagerApplicationResponse> reject(
            @PathVariable Long id,
            @Valid @RequestBody StationManagerReviewRequest request,
            Authentication auth) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(stationManagerApplicationService.reject(id, auth.getName(), request));
    }

    @PostMapping("/{id}/issue-credentials")
    public ResponseEntity<StationManagerApplicationResponse> issueCredentials(@PathVariable Long id,
                                                                              @Valid @RequestBody StationManagerCredentialIssueRequest request,
                                                                              Authentication auth) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(stationManagerApplicationService.issuePortalCredentials(id, auth.getName(), request));
    }

    @GetMapping("/{id}/files/{slotType}")
    public ResponseEntity<byte[]> downloadStandardFile(@PathVariable Long id,
                                                       @PathVariable StationManagerFileSlot slotType,
                                                       Authentication auth) {
        return buildFileResponse(stationManagerApplicationService.getAdminStandardFile(
                id, slotType, auth.getName()));
    }

    @GetMapping("/{id}/business-documents/{documentType}/file")
    public ResponseEntity<byte[]> downloadBusinessDocumentFile(@PathVariable Long id,
                                                               @PathVariable StationManagerBusinessDocumentType documentType,
                                                               Authentication auth) {
        return buildFileResponse(stationManagerApplicationService.getAdminBusinessDocumentFile(
                id, documentType, auth.getName()));
    }

    private ResponseEntity<byte[]> buildFileResponse(StationManagerFileService.DownloadedFile file) {
        String disposition = ContentDisposition.attachment()
                .filename(file.fileName(), StandardCharsets.UTF_8)
                .build()
                .toString();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(file.data().length)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "sandbox; default-src 'none'")
                .header("Cross-Origin-Resource-Policy", "same-origin")
                .header("Referrer-Policy", "no-referrer")
                .body(file.data());
    }
}
