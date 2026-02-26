package com.plugin.dto.request;

import com.plugin.enums.PointType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class ChargingPointRequest {
    @NotBlank
    private String identifier;
    @NotNull
    private Long stationId;
    @NotNull
    private PointType pointType;
    @NotNull @Positive
    private Double maxPowerKw;
    private String connectorType;
}
