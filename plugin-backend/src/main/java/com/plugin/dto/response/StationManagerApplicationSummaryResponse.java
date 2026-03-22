package com.plugin.dto.response;

import com.plugin.enums.StationManagerApplicationStatus;
import com.plugin.enums.StationManagerBusinessType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class StationManagerApplicationSummaryResponse {
    private Long id;
    private Long userId;
    private String applicationReferenceId;
    private String fullName;
    private String email;
    private String phone;
    private StationManagerBusinessType businessType;
    private String businessName;
    private String stationName;
    private String stationCity;
    private String stationState;
    private StationManagerApplicationStatus status;
    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;
    private String reviewedBy;
    private String reviewNotes;
}
