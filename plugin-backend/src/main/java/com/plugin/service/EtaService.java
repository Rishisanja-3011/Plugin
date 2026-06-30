package com.plugin.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@Slf4j
public class EtaService {

    private static final double EARTH_RADIUS_METERS = 6_371_000;
    private static final double FALLBACK_METERS_PER_SECOND = 35_000.0 / 3600.0;

    private final RestTemplate restTemplate;
    private final ConcurrentMap<String, CachedEta> cache = new ConcurrentHashMap<>();

    @Value("${GOOGLE_MAPS_API_KEY:}")
    private String googleMapsApiKey;

    @Value("${app.maps.google.distance-matrix-url:https://maps.googleapis.com/maps/api/distancematrix/json}")
    private String distanceMatrixUrl;

    @Value("${app.maps.google.cache-ttl-seconds:60}")
    private long cacheTtlSeconds;

    public EtaService(RestTemplateBuilder restTemplateBuilder) {
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(4))
                .setReadTimeout(Duration.ofSeconds(6))
                .build();
    }

    public EtaResult estimate(double originLatitude,
                              double originLongitude,
                              double destinationLatitude,
                              double destinationLongitude) {
        double directDistanceMeters = distanceMeters(
                originLatitude, originLongitude, destinationLatitude, destinationLongitude);
        String cacheKey = cacheKey(originLatitude, originLongitude, destinationLatitude, destinationLongitude);
        Instant now = Instant.now();
        CachedEta cached = cache.get(cacheKey);
        if (cached != null && cached.expiresAt().isAfter(now)) {
            return cached.result();
        }

        EtaResult result = hasGoogleMapsKey()
                ? googleEstimate(originLatitude, originLongitude, destinationLatitude, destinationLongitude, directDistanceMeters)
                : fallbackEstimate(directDistanceMeters);
        cache.put(cacheKey, new CachedEta(result, now.plusSeconds(Math.max(10, cacheTtlSeconds))));
        return result;
    }

    public static double distanceMeters(double originLatitude,
                                        double originLongitude,
                                        double destinationLatitude,
                                        double destinationLongitude) {
        double originLatRadians = Math.toRadians(originLatitude);
        double destinationLatRadians = Math.toRadians(destinationLatitude);
        double deltaLat = Math.toRadians(destinationLatitude - originLatitude);
        double deltaLon = Math.toRadians(destinationLongitude - originLongitude);

        double a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
                + Math.cos(originLatRadians) * Math.cos(destinationLatRadians)
                * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_METERS * c;
    }

    private EtaResult googleEstimate(double originLatitude,
                                     double originLongitude,
                                     double destinationLatitude,
                                     double destinationLongitude,
                                     double fallbackDistanceMeters) {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(distanceMatrixUrl)
                    .queryParam("origins", coordinate(originLatitude, originLongitude))
                    .queryParam("destinations", coordinate(destinationLatitude, destinationLongitude))
                    .queryParam("mode", "driving")
                    .queryParam("departure_time", "now")
                    .queryParam("traffic_model", "best_guess")
                    .queryParam("key", googleMapsApiKey)
                    .build()
                    .toUri();

            Map<?, ?> response = restTemplate.getForObject(uri, Map.class);
            EtaResult parsed = parseGoogleResponse(response);
            if (parsed != null) {
                return parsed;
            }
        } catch (RestClientException | ClassCastException ex) {
            log.warn("Google Distance Matrix ETA lookup failed; using fallback ETA", ex);
        }
        return fallbackEstimate(fallbackDistanceMeters);
    }

    private EtaResult parseGoogleResponse(Map<?, ?> response) {
        if (response == null || !"OK".equals(String.valueOf(response.get("status")))) {
            return null;
        }

        List<?> rows = (List<?>) response.get("rows");
        if (rows == null || rows.isEmpty()) {
            return null;
        }
        Map<?, ?> firstRow = (Map<?, ?>) rows.get(0);
        List<?> elements = (List<?>) firstRow.get("elements");
        if (elements == null || elements.isEmpty()) {
            return null;
        }

        Map<?, ?> element = (Map<?, ?>) elements.get(0);
        if (!"OK".equals(String.valueOf(element.get("status")))) {
            return null;
        }

        Object durationContainer = element.get("duration_in_traffic") != null
                ? element.get("duration_in_traffic")
                : element.get("duration");
        long durationSeconds = numericValue((Map<?, ?>) durationContainer);
        long distanceMeters = numericValue((Map<?, ?>) element.get("distance"));
        if (durationSeconds <= 0 || distanceMeters <= 0) {
            return null;
        }
        return new EtaResult(durationSeconds, (double) distanceMeters, true);
    }

    private long numericValue(Map<?, ?> valueContainer) {
        if (valueContainer == null) {
            return 0;
        }
        Object value = valueContainer.get("value");
        return value instanceof Number number ? number.longValue() : 0;
    }

    private EtaResult fallbackEstimate(double distanceMeters) {
        long durationSeconds = Math.max(60, Math.round(distanceMeters / FALLBACK_METERS_PER_SECOND));
        return new EtaResult(durationSeconds, distanceMeters, false);
    }

    private boolean hasGoogleMapsKey() {
        return googleMapsApiKey != null && !googleMapsApiKey.isBlank();
    }

    private String coordinate(double latitude, double longitude) {
        return String.format(Locale.US, "%.6f,%.6f", latitude, longitude);
    }

    private String cacheKey(double originLatitude,
                            double originLongitude,
                            double destinationLatitude,
                            double destinationLongitude) {
        return String.format(Locale.US, "%.4f,%.4f:%.4f,%.4f",
                originLatitude, originLongitude, destinationLatitude, destinationLongitude);
    }

    public record EtaResult(long durationSeconds, double distanceMeters, boolean liveTraffic) {}

    private record CachedEta(EtaResult result, Instant expiresAt) {}
}
