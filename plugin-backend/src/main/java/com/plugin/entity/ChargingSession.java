package com.plugin.entity;

import com.plugin.enums.SessionStatus;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "chargingSessions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChargingSession {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    private Booking booking;

    private Long bookingId;

    private ChargingPoint chargingPoint;

    private Long chargingPointId;

    private User customer;

    private Long customerId;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private BigDecimal energyDeliveredKwh;

    private SessionStatus status;

    private BigDecimal walletDebitedAmount;

    private BigDecimal walletBalanceAfterLastDebit;

    private LocalDateTime walletLastCheckedAt;

    private Boolean autoStoppedForWallet;

    private String walletStopReason;

    private LocalDateTime createdAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) status = SessionStatus.IN_PROGRESS;
        if (walletDebitedAmount == null) walletDebitedAmount = BigDecimal.ZERO.setScale(2);
    }
}
