package com.plugin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.plugin.dto.response.EnergyResponses.GridPoint;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
public class ExternalGridDataProvider implements GridDataProvider {
    private final RestClient restClient;
    private final String baseUrl;
    private final String apiKey;

    public ExternalGridDataProvider(RestClient.Builder builder,
                                    @Value("${app.energy.external.base-url:}") String baseUrl,
                                    @Value("${app.energy.external.api-key:}") String apiKey,
                                    @Value("${app.energy.external.connect-timeout-ms:3000}") int connectTimeoutMs,
                                    @Value("${app.energy.external.read-timeout-ms:5000}") int readTimeoutMs) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Math.max(500, connectTimeoutMs));
        requestFactory.setReadTimeout(Math.max(500, readTimeoutMs));
        this.restClient = builder.requestFactory(requestFactory).build();
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    @Override
    public String id() {
        return "external";
    }

    @Override
    public List<GridPoint> forecast(String region, LocalDateTime from, int hours) {
        if (baseUrl.isBlank() || apiKey.isBlank()) {
            throw new IllegalStateException("External grid provider is not configured");
        }
        JsonNode root = restClient.get()
                .uri(baseUrl + "/forecast?region={region}&hours={hours}", region, hours)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .retrieve()
                .body(JsonNode.class);
        JsonNode values = root == null ? null : root.path("points");
        if (values == null || !values.isArray() || values.isEmpty()) {
            throw new IllegalStateException("External grid provider returned no forecast points");
        }
        List<GridPoint> result = new ArrayList<>();
        for (JsonNode value : values) {
            BigDecimal renewableShare = bounded(value, "renewableSharePercent", 0, 100);
            BigDecimal gridLoad = bounded(value, "gridLoadPercent", 0, 100);
            BigDecimal carbon = bounded(value, "carbonIntensityGco2PerKwh", 0, 2000);
            BigDecimal price = bounded(value, "electricityPricePerKwh", 0, 1000);
            result.add(GridPoint.builder()
                    .gridRegion(region)
                    .timestamp(LocalDateTime.parse(value.path("timestamp").asText()))
                    .totalDemandKw(decimal(value, "totalDemandKw"))
                    .renewableGenerationKw(decimal(value, "renewableGenerationKw"))
                    .renewableSharePercent(renewableShare)
                    .solarGenerationKw(decimal(value, "solarGenerationKw"))
                    .windGenerationKw(decimal(value, "windGenerationKw"))
                    .gridLoadPercent(gridLoad)
                    .carbonIntensityGco2PerKwh(carbon)
                    .electricityPricePerKwh(price)
                    .source("Configured external grid provider")
                    .dataMode("LIVE")
                    .quality("VERIFIED_BY_PROVIDER")
                    .generatedAt(LocalDateTime.now())
                    .build());
        }
        return result;
    }

    private static BigDecimal decimal(JsonNode value, String field) {
        if (!value.hasNonNull(field) || !value.path(field).isNumber()) {
            throw new IllegalStateException("External grid provider omitted " + field);
        }
        return value.path(field).decimalValue();
    }

    private static BigDecimal bounded(JsonNode value, String field, double min, double max) {
        BigDecimal number = decimal(value, field);
        if (number.compareTo(BigDecimal.valueOf(min)) < 0 || number.compareTo(BigDecimal.valueOf(max)) > 0) {
            throw new IllegalStateException("External grid provider returned an invalid " + field);
        }
        return number;
    }
}
