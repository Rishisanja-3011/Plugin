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
    private String chargingPointType;
    private String connectorType;
    private Double chargingPointMaxPowerKw;
    private Long customerId;
    private String customerName;
    private String stationName;
    private String gridRegion;
    private Long vehicleId;
    private String vehicleNickname;
    private String vehicleMake;
    private String vehicleModel;
    private String vehicleRegistration;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private LocalDateTime scheduledStartTime;
    private LocalDateTime scheduledEndTime;
    private Long elapsedSeconds;
    private Long remainingSeconds;
    private Long scheduledDurationSeconds;
    private BigDecimal energyDeliveredKwh;
    private String chargingPreference;
    private BigDecimal expectedRenewableSharePercent;
    private BigDecimal expectedCarbonKg;
    private BigDecimal estimatedCarbonSavedKg;
    private Integer greenScore;
    private String energyDataMode;
    private String energySource;
    private BigDecimal estimateRate;
    private String estimateRateType;
    private BigDecimal estimatedAmount;
    private BigDecimal walletDebitedAmount;
    private BigDecimal walletBalanceAfterLastDebit;
    private LocalDateTime walletLastCheckedAt;
    private Boolean autoStoppedForWallet;
    private String walletStopReason;
    private String status;
}
