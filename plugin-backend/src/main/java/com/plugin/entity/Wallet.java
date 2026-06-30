package com.plugin.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "wallets")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Wallet {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    @Indexed(unique = true)
    private Long customerId;

    private BigDecimal balance;

    private boolean autoTopUpEnabled;

    private BigDecimal autoTopUpThreshold;

    private BigDecimal autoTopUpAmount;

    private BigDecimal maxAutoDebitAmount;

    private String razorpayCustomerId;

    private String razorpayTokenId;

    private String mandateMethod;

    private String mandateStatus;

    private String mandateFailureReason;

    private String paymentMethodLabel;

    private String paymentMethodLast4;

    private String paymentMethodNetwork;

    private String mandateOrderId;

    private String mandatePaymentId;

    private LocalDateTime mandateConfirmedAt;

    private LocalDateTime lastAutoTopUpAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (balance == null) balance = BigDecimal.ZERO.setScale(2);
        if (autoTopUpThreshold == null) autoTopUpThreshold = BigDecimal.valueOf(200).setScale(2);
        if (autoTopUpAmount == null) autoTopUpAmount = BigDecimal.valueOf(1000).setScale(2);
        if (maxAutoDebitAmount == null) maxAutoDebitAmount = BigDecimal.valueOf(15000).setScale(2);
        if (mandateStatus == null) mandateStatus = "NOT_CONFIGURED";
    }

    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
