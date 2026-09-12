package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.GridPoint;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class RenewableEnergyService {
    private final Map<String, GridDataProvider> providers;
    private final DemoGridDataProvider demoProvider;
    private final String configuredProvider;
    private final String defaultRegion;
    private final long cacheSeconds;
    private final Map<String, CachedForecast> cache = new ConcurrentHashMap<>();
    private final Map<String, LocalDateTime> retryAfter = new ConcurrentHashMap<>();

    public RenewableEnergyService(List<GridDataProvider> providers,
                                  DemoGridDataProvider demoProvider,
                                  @Value("${app.energy.provider:india-energy-atlas}") String configuredProvider,
                                  @Value("${app.energy.default-region:IN-WE}") String defaultRegion,
                                  @Value("${app.energy.cache-seconds:300}") long cacheSeconds) {
        this.providers = providers.stream().collect(java.util.stream.Collectors.toUnmodifiableMap(GridDataProvider::id, p -> p));
        this.demoProvider = demoProvider;
        this.configuredProvider = configuredProvider.toLowerCase();
        this.defaultRegion = defaultRegion;
        this.cacheSeconds = Math.max(30, cacheSeconds);
    }

    public GridPoint current(String region) {
        return forecast(region, 1).get(0);
    }

    public synchronized List<GridPoint> forecast(String region, int hours) {
        String safeRegion = region == null || region.isBlank() ? defaultRegion : region.trim().toUpperCase();
        if (!List.of("IN-NR", "IN-WE", "IN-SR", "IN-ER", "IN-NER").contains(safeRegion)) {
            throw new com.plugin.exception.BadRequestException("Select a valid India grid region");
        }
        int safeHours = Math.max(1, Math.min(48, hours));
        String key = configuredProvider + ":" + safeRegion;
        CachedForecast cached = cache.get(key);
        if (cached != null && cached.expiresAt().isAfter(LocalDateTime.now())) {
            return first(cached.points(), safeHours);
        }
        if (retryAfter.getOrDefault(key, LocalDateTime.MIN).isAfter(LocalDateTime.now())) {
            if (cached != null) return first(stale(cached.points()), safeHours);
            throw new IllegalStateException("Renewable grid data is temporarily unavailable");
        }
        GridDataProvider selected = providers.get(configuredProvider);
        if (selected == null) {
            throw new IllegalStateException("Unknown grid data provider: " + configuredProvider);
        }
        List<GridPoint> points;
        try {
            // Fetch one reusable horizon so current, mobile, operator and grid views
            // share a single provider call within the cache window.
            points = selected.forecast(safeRegion, LocalDateTime.now(), 48);
            if (points == null || points.isEmpty()) throw new IllegalStateException("Empty grid forecast");
        } catch (RuntimeException ex) {
            retryAfter.put(key, LocalDateTime.now().plusSeconds(cacheSeconds));
            if (cached != null && !cached.points().isEmpty()) {
                log.warn("Grid provider {} unavailable; returning stale cached data", selected.id());
                return first(stale(cached.points()), safeHours);
            }
            log.warn("Grid provider {} unavailable and no cached result exists", selected.id());
            throw new IllegalStateException("Renewable grid data is temporarily unavailable", ex);
        }
        List<GridPoint> immutable = List.copyOf(points);
        retryAfter.remove(key);
        cache.put(key, new CachedForecast(immutable, LocalDateTime.now().plusSeconds(cacheSeconds)));
        return first(immutable, safeHours);
    }

    private static List<GridPoint> first(List<GridPoint> points, int count) {
        return points.subList(0, Math.min(count, points.size()));
    }

    private static List<GridPoint> stale(List<GridPoint> points) {
        return points.stream().map(point -> GridPoint.builder()
                .gridRegion(point.getGridRegion())
                .timestamp(point.getTimestamp())
                .totalDemandKw(point.getTotalDemandKw())
                .renewableGenerationKw(point.getRenewableGenerationKw())
                .renewableSharePercent(point.getRenewableSharePercent())
                .solarGenerationKw(point.getSolarGenerationKw())
                .windGenerationKw(point.getWindGenerationKw())
                .gridLoadPercent(point.getGridLoadPercent())
                .carbonIntensityGco2PerKwh(point.getCarbonIntensityGco2PerKwh())
                .electricityPricePerKwh(point.getElectricityPricePerKwh())
                .source(point.getSource())
                .dataMode("STALE")
                .quality("STALE_PROVIDER_DATA")
                .methodology(point.getMethodology())
                .sourceTimestamp(point.getSourceTimestamp())
                .generatedAt(point.getGeneratedAt())
                .build()).toList();
    }

    private record CachedForecast(List<GridPoint> points, LocalDateTime expiresAt) {}
}
