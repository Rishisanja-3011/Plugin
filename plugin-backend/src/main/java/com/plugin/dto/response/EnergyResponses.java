package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class EnergyResponses {
    private EnergyResponses() {}

    @Data @Builder
    public static class GridPoint {
        private String gridRegion;
        private LocalDateTime timestamp;
        private BigDecimal totalDemandKw;
        private BigDecimal renewableGenerationKw;
        private BigDecimal renewableSharePercent;
        private BigDecimal solarGenerationKw;
        private BigDecimal windGenerationKw;
        private BigDecimal gridLoadPercent;
        private BigDecimal carbonIntensityGco2PerKwh;
        private BigDecimal electricityPricePerKwh;
        private String source;
        private String dataMode;
        private String quality;
        private String methodology;
        private LocalDateTime sourceTimestamp;
        private LocalDateTime generatedAt;
    }

    @Data @Builder
    public static class ChargingOption {
        private String scheduleType;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private BigDecimal chargingPowerKw;
        private BigDecimal expectedRenewableSharePercent;
        private BigDecimal expectedGridLoadPercent;
        private BigDecimal expectedPricePerKwh;
        private BigDecimal basePricePerKwh;
        private BigDecimal discountPercent;
        private BigDecimal renewableDiscountPercent;
        private BigDecimal gridIncentivePercent;
        private BigDecimal utilizationAdjustmentPercent;
        private BigDecimal expectedTotalCost;
        private BigDecimal expectedCarbonKg;
        private BigDecimal estimatedCarbonSavedKg;
        private BigDecimal baselineRenewableSharePercent;
        private BigDecimal baselinePricePerKwh;
        private BigDecimal baselineTotalCost;
        private BigDecimal estimatedMoneySaved;
        private BigDecimal renewableEnergyShiftedKwh;
        private int greenScore;
        private String explanation;
        private String dataMode;
        private String source;
        private String quality;
        private BigDecimal confidencePercent;
        private LocalDateTime sourceTimestamp;
        private Integer forecastHorizonMinutes;
        private boolean cached;
        private boolean simulated;
        private String fallbackReason;
        private String objective;
        private String gridSignalType;
        private Integer requestedReductionPercent;
    }

    @Data @Builder
    public static class ChargingOptions {
        private Long stationId;
        private String gridRegion;
        private String requestedPreference;
        private List<ChargingOption> options;
        private String dataMode;
        private String disclaimer;
        private LocalDateTime generatedAt;
        private String bestOptionType;
        private String constraintSummary;
        private BigDecimal confidencePercent;
        private String source;
        private String quality;
        private LocalDateTime sourceTimestamp;
        private boolean cached;
        private boolean simulated;
        private String fallbackReason;
    }

    @Data @Builder
    public static class OperatorDashboard {
        private String gridRegion;
        private GridPoint current;
        private LocalDateTime nextRenewableSurplusStart;
        private BigDecimal nextRenewableSurplusPercent;
        private LocalDateTime nextPeakRiskStart;
        private BigDecimal predictedPeakLoadPercent;
        private BigDecimal configuredStationCapacityKw;
        private BigDecimal availableCapacityKw;
        private BigDecimal currentChargingLoadKw;
        private BigDecimal renewableUtilizationPercent;
        private BigDecimal localSolarCurrentKw;
        private BigDecimal localSolarForecastKw;
        private BigDecimal batteryCapacityKwh;
        private BigDecimal batteryStateOfChargePercent;
        private BigDecimal batteryDispatchPowerKw;
        private String batteryAction;
        private String batteryActionReason;
        private String stationEnergyDataMode;
        private String recommendation;
        private GridSignalSummary activeGridSignal;
        private String dataMode;
        private List<GridPoint> forecast;
        private List<DemandForecastPoint> demandForecast;
    }

    @Data @Builder
    public static class GridSignalSummary {
        private String signalType;
        private Integer requestedReductionPercent;
        private LocalDateTime startsAt;
        private LocalDateTime endsAt;
        private String message;
    }

    @Data @Builder
    public static class StationRecommendation {
        private Long stationId;
        private String stationName;
        private String city;
        private String state;
        private String gridRegion;
        private long availablePoints;
        private BigDecimal renewableSharePercent;
        private BigDecimal regionalRenewableSharePercent;
        private BigDecimal localRenewablePowerKw;
        private BigDecimal distanceKm;
        private Integer predictedQueueMinutes;
        private BigDecimal estimatedDynamicPricePerKwh;
        private int recommendationScore;
        private boolean recommendedGreenStation;
        private String reason;
        private String dataMode;
        private LocalDateTime sourceTimestamp;
    }

    @Data @Builder
    public static class DemandForecastPoint {
        private Long stationId;
        private LocalDateTime timestamp;
        private BigDecimal expectedBookings;
        private BigDecimal expectedChargingDemandKw;
        private BigDecimal stationCapacityKw;
        private BigDecimal utilizationPercent;
        private boolean overloadRisk;
        private BigDecimal confidencePercent;
        private String source;
        private String dataMode;
    }
}
