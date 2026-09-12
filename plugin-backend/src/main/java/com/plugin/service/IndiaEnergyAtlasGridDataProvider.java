package com.plugin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.plugin.dto.response.EnergyResponses.GridPoint;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * India-specific renewable signal backed by India Energy Atlas fuel-mix data.
 *
 * The sandbox endpoint exposes recent hourly fuel mix rather than a guaranteed
 * forward renewable forecast. We therefore roll the latest 24-hour profile
 * forward as an explicitly labelled forecast instead of presenting it as a
 * live utility dispatch instruction.
 */
@Component
public class IndiaEnergyAtlasGridDataProvider implements GridDataProvider {
    private static final String SOURCE = "India Energy Atlas regional aggregate fuel mix";
    private static final Map<String, List<String>> REGION_STATES = Map.of(
            "IN-NR", List.of("chandigarh", "delhi", "haryana", "himachal-pradesh", "jammu-and-kashmir", "ladakh", "punjab", "rajasthan", "uttar-pradesh", "uttarakhand"),
            "IN-WE", List.of("chhattisgarh", "dadra-and-nagar-haveli-and-daman-and-diu", "goa", "gujarat", "madhya-pradesh", "maharashtra"),
            "IN-SR", List.of("andhra-pradesh", "karnataka", "kerala", "puducherry", "tamil-nadu", "telangana"),
            "IN-ER", List.of("bihar", "jharkhand", "odisha", "sikkim", "west-bengal"),
            "IN-NER", List.of("arunachal-pradesh", "assam", "manipur", "meghalaya", "mizoram", "nagaland", "tripura")
    );
    private static final Map<String, BigDecimal> EMISSION_FACTORS = Map.of(
            "coal", BigDecimal.valueOf(820),
            "gas", BigDecimal.valueOf(490),
            "diesel", BigDecimal.valueOf(650),
            "nuclear", BigDecimal.valueOf(12),
            "hydro", BigDecimal.valueOf(24),
            "wind", BigDecimal.valueOf(11),
            "solar", BigDecimal.valueOf(48),
            "biomass", BigDecimal.valueOf(230)
    );

    private final RestClient restClient;
    private final String baseUrl;
    private final String apiKey;
    private JsonNode cachedResponse;
    private java.time.Instant responseExpiresAt = java.time.Instant.MIN;

    private synchronized JsonNode fuelMix() {
        if (cachedResponse != null && responseExpiresAt.isAfter(java.time.Instant.now())) return cachedResponse;
        JsonNode response = restClient.get().uri(baseUrl + "/fuel-mix/latest?hours=24")
                .header("X-API-Key", apiKey).header(HttpHeaders.ACCEPT, "application/json")
                .retrieve().body(JsonNode.class);
        if (response == null || !response.path("data").path("items").isArray()
                || response.path("data").path("items").isEmpty()) {
            throw new IllegalStateException("India Energy Atlas returned no fuel-mix data");
        }
        cachedResponse = response;
        responseExpiresAt = java.time.Instant.now().plusSeconds(300);
        return response;
    }

    public IndiaEnergyAtlasGridDataProvider(RestClient.Builder builder,
                                            @Value("${app.energy.external.base-url:https://api.energymap.in/developer/v1}") String baseUrl,
                                            @Value("${app.energy.external.api-key:}") String apiKey,
                                            @Value("${app.energy.external.connect-timeout-ms:3000}") int connectTimeoutMs,
                                            @Value("${app.energy.external.read-timeout-ms:10000}") int readTimeoutMs) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Math.max(500, connectTimeoutMs));
        requestFactory.setReadTimeout(Math.max(500, readTimeoutMs));
        this.restClient = builder.requestFactory(requestFactory).build();
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    @Override
    public String id() {
        return "india-energy-atlas";
    }

    @Override
    public List<GridPoint> forecast(String region, LocalDateTime from, int hours) {
        if (apiKey.isBlank()) {
            throw new IllegalStateException("India Energy Atlas is not configured");
        }

        String normalizedRegion = normalizeRegion(region);
        JsonNode root = fuelMix();
        JsonNode states = root == null ? null : root.path("data").path("items");
        if (states == null || !states.isArray() || states.isEmpty()) {
            throw new IllegalStateException("India Energy Atlas returned no fuel-mix data");
        }

        Map<LocalDateTime, Bucket> buckets = aggregate(states, normalizedRegion);
        List<Bucket> profile = buckets.values().stream()
                .sorted(Comparator.comparing(Bucket::timestamp))
                .toList();
        if (profile.isEmpty()) {
            throw new IllegalStateException("India Energy Atlas returned no usable fuel-mix points");
        }

        BigDecimal peakGeneration = profile.stream()
                .map(Bucket::totalGenerationMw)
                .max(BigDecimal::compareTo)
                .orElse(BigDecimal.ONE);
        LocalDateTime firstHour = from.withMinute(0).withSecond(0).withNano(0);

        List<GridPoint> result = new ArrayList<>();
        for (int index = 0; index < hours; index++) {
            LocalDateTime target = firstHour.plusHours(index);
            Bucket source = closestHour(profile, target.getHour());
            result.add(toGridPoint(normalizedRegion, target, source, peakGeneration));
        }
        return result;
    }

    private static Map<LocalDateTime, Bucket> aggregate(JsonNode states, String region) {
        Map<LocalDateTime, Bucket> buckets = new HashMap<>();
        List<String> includedStates = REGION_STATES.get(region);
        for (JsonNode state : states) {
            String stateSlug = state.path("state_slug").asText("").toLowerCase(Locale.ROOT);
            if (includedStates != null && !includedStates.contains(stateSlug)) continue;
            for (JsonNode point : state.path("points")) {
                if (!point.path("timestamp").isTextual() || !point.path("generation_mw").isNumber()) continue;
                LocalDateTime timestamp = OffsetDateTime.parse(point.path("timestamp").asText())
                        .atZoneSameInstant(java.time.ZoneId.of("Asia/Kolkata"))
                        .toLocalDateTime().withMinute(0).withSecond(0).withNano(0);
                String fuel = point.path("fuel_type").asText("").toLowerCase(Locale.ROOT);
                BigDecimal generation = point.path("generation_mw").decimalValue().max(BigDecimal.ZERO);
                buckets.computeIfAbsent(timestamp, Bucket::new).add(fuel, generation);
            }
        }
        return buckets;
    }

    private static String normalizeRegion(String region) {
        String normalized = region == null ? "IN-WE" : region.trim().toUpperCase(Locale.ROOT);
        if (!REGION_STATES.containsKey(normalized)) {
            throw new IllegalArgumentException("Unsupported India grid region: " + normalized);
        }
        return normalized;
    }

    private static Bucket closestHour(List<Bucket> profile, int hour) {
        return profile.stream()
                .min(Comparator.comparingInt(bucket -> circularHourDistance(bucket.timestamp().getHour(), hour)))
                .orElseThrow();
    }

    private static int circularHourDistance(int left, int right) {
        int distance = Math.abs(left - right);
        return Math.min(distance, 24 - distance);
    }

    private static GridPoint toGridPoint(String region, LocalDateTime timestamp, Bucket bucket,
                                         BigDecimal peakGeneration) {
        BigDecimal total = bucket.totalGenerationMw().max(BigDecimal.valueOf(0.001));
        BigDecimal renewable = bucket.renewableGenerationMw();
        BigDecimal renewableShare = percent(renewable, total);
        BigDecimal load = percent(total, peakGeneration.max(BigDecimal.valueOf(0.001)));
        BigDecimal carbon = bucket.carbonWeightedGeneration().divide(total, 2, RoundingMode.HALF_UP);
        BigDecimal price = BigDecimal.valueOf(8)
                .add(load.multiply(BigDecimal.valueOf(0.06)))
                .add(BigDecimal.valueOf(100).subtract(renewableShare).multiply(BigDecimal.valueOf(0.04)))
                .setScale(2, RoundingMode.HALF_UP);
        return GridPoint.builder()
                .gridRegion(region)
                .timestamp(timestamp)
                .totalDemandKw(total.multiply(BigDecimal.valueOf(1000)).setScale(2, RoundingMode.HALF_UP))
                .renewableGenerationKw(renewable.multiply(BigDecimal.valueOf(1000)).setScale(2, RoundingMode.HALF_UP))
                .renewableSharePercent(renewableShare)
                .solarGenerationKw(bucket.generation("solar").multiply(BigDecimal.valueOf(1000)))
                .windGenerationKw(bucket.generation("wind").multiply(BigDecimal.valueOf(1000)))
                .gridLoadPercent(load)
                .carbonIntensityGco2PerKwh(carbon)
                .electricityPricePerKwh(price)
                .source(SOURCE)
                .dataMode("FORECAST")
                .quality("ATLAS_24H_PROFILE_DERIVED")
                .sourceTimestamp(bucket.timestamp())
                .methodology("Renewable share is derived from regional fuel mix. Load is generation relative to the sampled daily peak, not measured grid capacity utilization. Price is a planning model, not a utility tariff or station charge. Carbon intensity uses fixed fuel emission factors. Forecast repeats the recent hourly profile.")
                .generatedAt(LocalDateTime.now())
                .build();
    }

    private static BigDecimal percent(BigDecimal part, BigDecimal total) {
        return part.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP)
                .max(BigDecimal.ZERO).min(BigDecimal.valueOf(100));
    }

    private static String stripTrailingSlash(String value) {
        String result = value == null ? "" : value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        return result;
    }

    private static final class Bucket {
        private final LocalDateTime timestamp;
        private final Map<String, BigDecimal> generation = new HashMap<>();

        private Bucket(LocalDateTime timestamp) {
            this.timestamp = timestamp;
        }

        private void add(String fuel, BigDecimal value) {
            generation.merge(fuel, value, BigDecimal::add);
        }

        private LocalDateTime timestamp() { return timestamp; }

        private BigDecimal generation(String fuel) {
            return generation.getOrDefault(fuel, BigDecimal.ZERO);
        }

        private BigDecimal totalGenerationMw() {
            return generation.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        private BigDecimal renewableGenerationMw() {
            return generation("solar").add(generation("wind")).add(generation("hydro"))
                    .add(generation("biomass")).add(generation("small_hydro"));
        }

        private BigDecimal carbonWeightedGeneration() {
            return generation.entrySet().stream()
                    .map(entry -> entry.getValue().multiply(EMISSION_FACTORS.getOrDefault(
                            entry.getKey(), BigDecimal.valueOf(600))))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
    }
}
