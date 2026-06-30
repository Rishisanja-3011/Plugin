package com.plugin.entity;

import com.plugin.enums.WalletLedgerType;
import com.plugin.enums.WalletTransactionStatus;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "walletLedgerEntries")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WalletLedgerEntry {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    @Indexed
    private Long walletId;

    @Indexed
    private Long customerId;

    private WalletLedgerType type;

    private WalletTransactionStatus status;

    private BigDecimal amount;

    private BigDecimal balanceAfter;

    private String referenceType;

    private String referenceId;

    private String razorpayOrderId;

    private String razorpayPaymentId;

    private String description;

    private LocalDateTime createdAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) status = WalletTransactionStatus.SUCCEEDED;
    }
}
