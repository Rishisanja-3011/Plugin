package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data @Builder
public class PricingResponse {
    private Long id;
    private Long stationId;
    private String stationName;
    private String pointType;
    private String pricingModel;
    private BigDecimal ratePerUnit;
    private String description;
}
