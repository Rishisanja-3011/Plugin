package com.plugin.entity;

import com.plugin.enums.WalletTransactionStatus;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.time.LocalDateTime;

@Document(collection = "walletTopUpAttempts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WalletTopUpAttempt {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    @Indexed
    private Long walletId;

    @Indexed
    private Long customerId;

    private String triggerReason;

    private BigDecimal amount;

    private WalletTransactionStatus status;

    @Indexed(unique = true, sparse = true)
    private String razorpayOrderId;

    @Indexed(name = "uk_wallet_top_up_payment_id", unique = true, sparse = true)
    private String razorpayPaymentId;

    private BigDecimal refundedAmount;

    private List<String> razorpayRefundIds;

    private String failureReason;

    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    private LocalDateTime lastRefundedAt;

    @Version
    private Long version;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) status = WalletTransactionStatus.PENDING;
        if (refundedAmount == null) refundedAmount = BigDecimal.ZERO.setScale(2);
        if (razorpayRefundIds == null) razorpayRefundIds = new ArrayList<>();
    }
}
