package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data @Builder
public class BillResponse {
    private Long id;
    private String invoiceNumber;
    private Long sessionId;
    private Long customerId;
    private String customerName;
    private Long stationId;
    private String stationName;
    private BigDecimal energyKwh;
    private Long durationMinutes;
    private Long durationSeconds;
    private BigDecimal rateApplied;
    private String rateType;
    private BigDecimal totalAmount;
    private String paymentStatus;
    private LocalDateTime createdAt;
    private LocalDateTime paidAt;
}
