package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data @Builder
public class BookingResponse {
    private Long id;
    private String referenceId;
    private Long customerId;
    private String customerName;
    private Long stationId;
    private String stationName;
    private Long chargingPointId;
    private String chargingPointIdentifier;
    private String pointType;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
