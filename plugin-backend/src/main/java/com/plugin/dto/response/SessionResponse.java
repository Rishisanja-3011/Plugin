package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data @Builder
public class SessionResponse {
    private Long id;
    private Long bookingId;
    private String bookingReference;
    private Long chargingPointId;
    private String chargingPointIdentifier;
    private Long customerId;
    private String customerName;
    private String stationName;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private BigDecimal energyDeliveredKwh;
    private String status;
}
