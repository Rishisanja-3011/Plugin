package com.plugin.dto.request;

import com.plugin.enums.PointType;
import com.plugin.enums.PricingModel;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class PricingRequest {
    @NotNull
    private Long stationId;
    @NotNull
    private PointType pointType;
    @NotNull
    private PricingModel pricingModel;
    @NotNull @Positive
    private BigDecimal ratePerUnit;
    private String description;
}
