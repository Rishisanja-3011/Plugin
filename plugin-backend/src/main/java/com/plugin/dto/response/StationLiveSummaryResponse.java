package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class StationLiveSummaryResponse {
    private long stationCount;
    private long connectorCount;
    private long available;
    private long busy;
    private long outOfService;
    private LocalDateTime lastUpdated;
    private LocalDateTime refreshedAt;
}
