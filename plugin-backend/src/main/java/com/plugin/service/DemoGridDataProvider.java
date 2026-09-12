package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.GridPoint;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
public class DemoGridDataProvider implements GridDataProvider {
    @Override
    public String id() {
        return "demo";
    }

    @Override
    public List<GridPoint> forecast(String region, LocalDateTime from, int hours) {
        LocalDateTime start = from.withMinute(0).withSecond(0).withNano(0);
        List<GridPoint> points = new ArrayList<>();
        for (int i = 0; i <= hours; i++) {
            LocalDateTime time = start.plusHours(i);
            int hour = time.getHour();
            double solarFactor = hour >= 6 && hour <= 18
                    ? Math.sin(Math.PI * (hour - 6) / 12.0) : 0.0;
            double morningPeak = gaussian(hour, 9, 2.2) * 18.0;
            double eveningPeak = gaussian(hour, 19, 2.6) * 34.0;
            double demand = 46.0 + morningPeak + eveningPeak;
            double solar = Math.max(0.0, solarFactor * 42.0);
            double wind = 12.0 + 4.0 * Math.sin((hour + 2) * Math.PI / 12.0);
            double renewableShare = clamp(14.0 + solar * 1.15 + wind * 0.55, 10.0, 88.0);
            double gridLoad = clamp(demand, 35.0, 96.0);
            double price = clamp(10.5 + gridLoad * 0.115 - renewableShare * 0.045, 8.0, 24.0);
            double carbon = clamp(760.0 - renewableShare * 7.0, 90.0, 690.0);
            points.add(GridPoint.builder()
                    .gridRegion(normalizeRegion(region))
                    .timestamp(time)
                    .totalDemandKw(n(demand * 1_000))
                    .renewableGenerationKw(n(demand * 1_000 * renewableShare / 100.0))
                    .renewableSharePercent(n(renewableShare))
                    .solarGenerationKw(n(solar * 1_000))
                    .windGenerationKw(n(wind * 1_000))
                    .gridLoadPercent(n(gridLoad))
                    .carbonIntensityGco2PerKwh(n(carbon))
                    .electricityPricePerKwh(n(price))
                    .source("PLUGIN India deterministic demo model")
                    .dataMode("DEMO")
                    .quality("SIMULATED")
                    .generatedAt(LocalDateTime.now())
                    .build());
        }
        return points;
    }

    private static double gaussian(int hour, int center, double width) {
        double distance = Math.min(Math.abs(hour - center), 24 - Math.abs(hour - center));
        return Math.exp(-(distance * distance) / (2.0 * width * width));
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static BigDecimal n(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private static String normalizeRegion(String region) {
        return region == null || region.isBlank() ? "IN-WE" : region.trim().toUpperCase();
    }
}
