package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class ChargingPointResponse {
    private Long id;
    private String identifier;
    private Long stationId;
    private String stationName;
    private String pointType;
    private Double maxPowerKw;
    private String connectorType;
    private String status;
}
