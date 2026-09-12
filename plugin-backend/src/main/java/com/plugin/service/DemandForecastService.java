package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.DemandForecastPoint;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class DemandForecastService {
    public List<DemandForecastPoint> forecast(Long stationId, BigDecimal stationCapacityKw, int hours) {
        double capacity = Math.max(1, stationCapacityKw.doubleValue());
        LocalDateTime start = LocalDateTime.now().withMinute(0).withSecond(0).withNano(0);
        List<DemandForecastPoint> points = new ArrayList<>();
        for (int i = 0; i <= Math.max(1, Math.min(48, hours)); i++) {
            LocalDateTime time = start.plusHours(i);
            int hour = time.getHour();
            double commuterPeak = gaussian(hour, 9, 2.3) * 0.30 + gaussian(hour, 19, 2.8) * 0.48;
            double overnight = hour < 6 ? 0.14 : 0;
            double weekdayFactor = time.getDayOfWeek().getValue() <= 5 ? 1.0 : 0.82;
            double utilization = Math.min(1.12, (0.18 + commuterPeak + overnight) * weekdayFactor);
            double demand = capacity * utilization;
            points.add(DemandForecastPoint.builder()
                    .stationId(stationId).timestamp(time)
                    .expectedBookings(n(Math.max(1, demand / 18.0)))
                    .expectedChargingDemandKw(n(demand)).stationCapacityKw(n(capacity))
                    .utilizationPercent(n(utilization * 100)).overloadRisk(utilization >= 0.9)
                    .confidencePercent(n(62)).source("PLUGIN explainable time-of-day EV demand model")
                    .dataMode("FORECAST").build());
        }
        return points;
    }

    private static double gaussian(int hour, int center, double width) {
        double distance = Math.min(Math.abs(hour - center), 24 - Math.abs(hour - center));
        return Math.exp(-(distance * distance) / (2 * width * width));
    }

    private static BigDecimal n(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }
}
