package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.GridPoint;
import com.plugin.entity.Station;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.ToDoubleFunction;

@Service
@RequiredArgsConstructor
public class ChargingImpactService {
    private static final Map<String, String> REGION_BY_STATE = Map.ofEntries(
            Map.entry("maharashtra", "IN-WE"), Map.entry("gujarat", "IN-WE"),
            Map.entry("goa", "IN-WE"), Map.entry("madhya pradesh", "IN-WE"),
            Map.entry("chhattisgarh", "IN-WE"), Map.entry("dadra and nagar haveli and daman and diu", "IN-WE"),
            Map.entry("delhi", "IN-NR"), Map.entry("chandigarh", "IN-NR"),
            Map.entry("haryana", "IN-NR"), Map.entry("punjab", "IN-NR"),
            Map.entry("rajasthan", "IN-NR"), Map.entry("himachal pradesh", "IN-NR"),
            Map.entry("jammu and kashmir", "IN-NR"), Map.entry("ladakh", "IN-NR"),
            Map.entry("uttar pradesh", "IN-NR"),
            Map.entry("uttarakhand", "IN-NR"), Map.entry("andhra pradesh", "IN-SR"),
            Map.entry("karnataka", "IN-SR"), Map.entry("kerala", "IN-SR"),
            Map.entry("puducherry", "IN-SR"), Map.entry("tamil nadu", "IN-SR"), Map.entry("telangana", "IN-SR"),
            Map.entry("bihar", "IN-ER"), Map.entry("jharkhand", "IN-ER"),
            Map.entry("odisha", "IN-ER"), Map.entry("sikkim", "IN-ER"), Map.entry("west bengal", "IN-ER"),
            Map.entry("arunachal pradesh", "IN-NER"), Map.entry("assam", "IN-NER"),
            Map.entry("manipur", "IN-NER"), Map.entry("meghalaya", "IN-NER"),
            Map.entry("mizoram", "IN-NER"), Map.entry("nagaland", "IN-NER"), Map.entry("tripura", "IN-NER")
    );

    private final RenewableEnergyService renewableEnergyService;

    public ChargingImpact snapshot(Station station, LocalDateTime start, LocalDateTime end,
                                   BigDecimal energyKwh, String preference) {
        String region = regionFor(station);
        int hours = (int) Math.min(48, Math.max(2, Duration.between(LocalDateTime.now(), end).toHours() + 2));
        List<GridPoint> forecast = renewableEnergyService.forecast(region, hours);
        List<GridPoint> covered = forecast.stream()
                .filter(point -> !point.getTimestamp().isBefore(start.withMinute(0)) && point.getTimestamp().isBefore(end))
                .toList();
        if (covered.isEmpty()) {
            covered = forecast.stream().filter(point -> !point.getTimestamp().isBefore(start.withMinute(0))).limit(1).toList();
        }
        if (covered.isEmpty()) throw new IllegalStateException("No grid outlook covers the booking window");

        double renewable = average(covered, point -> point.getRenewableSharePercent().doubleValue());
        double load = average(covered, point -> point.getGridLoadPercent().doubleValue());
        double carbon = average(covered, point -> point.getCarbonIntensityGco2PerKwh().doubleValue());
        double currentCarbon = forecast.get(0).getCarbonIntensityGco2PerKwh().doubleValue();
        double kwh = energyKwh.doubleValue();
        int greenScore = (int) Math.round(Math.max(0, Math.min(100,
                renewable * .65 + (100 - load) * .20 + (1 - carbon / 800.0) * 15)));
        GridPoint source = covered.get(0);
        return new ChargingImpact(
                preference,
                round(energyKwh.doubleValue()),
                round(renewable),
                round(forecast.get(0).getRenewableSharePercent().doubleValue()),
                round(kwh * carbon / 1000.0),
                round(Math.max(0, kwh * (currentCarbon - carbon) / 1000.0)),
                greenScore,
                source.getDataMode(),
                source.getSource(),
                source.getQuality(),
                LocalDateTime.now()
        );
    }

    public static String regionFor(Station station) {
        String state = station == null || station.getState() == null
                ? "" : station.getState().trim().toLowerCase(Locale.ROOT);
        return REGION_BY_STATE.getOrDefault(state, "IN-WE");
    }

    private static double average(List<GridPoint> points, ToDoubleFunction<GridPoint> mapper) {
        return points.stream().mapToDouble(mapper).average().orElse(0);
    }

    private static BigDecimal round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    public record ChargingImpact(
            String preference,
            BigDecimal requestedEnergyKwh,
            BigDecimal renewableSharePercent,
            BigDecimal baselineRenewableSharePercent,
            BigDecimal carbonKg,
            BigDecimal carbonSavedKg,
            int greenScore,
            String dataMode,
            String source,
            String quality,
            LocalDateTime capturedAt
    ) {}
}
