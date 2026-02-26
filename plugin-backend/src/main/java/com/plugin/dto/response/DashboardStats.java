package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data @Builder
public class DashboardStats {
    private long totalStations;
    private long activeStations;
    private long totalChargingPoints;
    private long availablePoints;
    private long totalBookings;
    private long activeBookings;
    private long totalSessions;
    private long activeSessions;
    private BigDecimal totalRevenue;
    private BigDecimal totalEnergyKwh;
    private long totalCustomers;
    private List<Map<String, Object>> busiestHours;
}
