package com.plugin.dto.response;

import com.plugin.dto.response.EnergyResponses.ChargingOption;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data @Builder
public class FlexibleChargingPlanResponse {
    private Long stationId;
    private String stationName;
    private Long chargingPointId;
    private String connectorType;
    private BigDecimal distanceKm;
    private ChargingOption selectedOption;
    private List<String> evaluatedStations;
    private String explanation;
    private LocalDateTime generatedAt;
}
