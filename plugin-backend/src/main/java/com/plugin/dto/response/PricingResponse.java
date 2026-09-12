package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data @Builder
public class PricingResponse {
    private Long id;
    private Long stationId;
    private String stationName;
    private String pointType;
    private String pricingModel;
    private BigDecimal ratePerUnit;
    private BigDecimal baseRatePerUnit;
    private BigDecimal discountPercent;
    private BigDecimal renewableSharePercent;
    private BigDecimal renewableDiscountPercent;
    private BigDecimal gridIncentivePercent;
    private BigDecimal utilizationAdjustmentPercent;
    private BigDecimal congestionAdjustmentPercent;
    private String gridSignalType;
    private LocalDateTime validAt;
    private boolean dynamicPricing;
    private String pricingFormula;
    private String description;
}
