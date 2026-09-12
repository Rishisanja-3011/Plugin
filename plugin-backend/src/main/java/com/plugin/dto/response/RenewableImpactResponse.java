package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data @Builder
public class RenewableImpactResponse {
    private long bookingsEvaluated;
    private long greenRecommendationsAccepted;
    private BigDecimal acceptanceRatePercent;
    private BigDecimal chargingEnergyKwh;
    private BigDecimal renewableEnergyUtilizedKwh;
    private BigDecimal demandShiftedKwh;
    private BigDecimal estimatedPeakDemandAvoidedKwh;
    private BigDecimal estimatedMoneySaved;
    private BigDecimal estimatedCarbonAvoidedKg;
    private BigDecimal averageRenewableSharePercent;
    private String methodology;
    private LocalDateTime generatedAt;
}
