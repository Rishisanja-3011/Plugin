package com.plugin.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter @Builder
public class WalletResponse {
    private Long id;
    private BigDecimal balance;
    private BigDecimal withdrawableBalance;
    private boolean autoTopUpEnabled;
    private BigDecimal autoTopUpThreshold;
    private BigDecimal autoTopUpAmount;
    private BigDecimal maxAutoDebitAmount;
    private String mandateStatus;
    private String mandateMethod;
    private String mandateFailureReason;
    private String paymentMethodLabel;
    private String paymentMethodLast4;
    private String paymentMethodNetwork;
    private LocalDateTime mandateConfirmedAt;
    private LocalDateTime lastAutoTopUpAt;
    private LocalDateTime updatedAt;
}
