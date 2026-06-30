package com.plugin.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter @Builder
public class WalletLedgerEntryResponse {
    private Long id;
    private String type;
    private String status;
    private BigDecimal amount;
    private BigDecimal balanceAfter;
    private String referenceType;
    private String referenceId;
    private String razorpayOrderId;
    private String razorpayPaymentId;
    private String description;
    private LocalDateTime createdAt;
}
