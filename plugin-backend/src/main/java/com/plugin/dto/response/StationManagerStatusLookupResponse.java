package com.plugin.dto.response;

import com.plugin.enums.StationManagerApplicationStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class StationManagerStatusLookupResponse {
    private String applicationReferenceId;
    private StationManagerApplicationStatus status;
    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;
    private String reviewNotes;
    private Boolean portalAccessReady;
    private LocalDateTime credentialsIssuedAt;
    private StationManagerApplicationResponse application;
}
