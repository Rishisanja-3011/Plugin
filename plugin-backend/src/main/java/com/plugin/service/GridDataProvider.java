package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.GridPoint;

import java.time.LocalDateTime;
import java.util.List;

public interface GridDataProvider {
    String id();
    List<GridPoint> forecast(String region, LocalDateTime from, int hours);
}
