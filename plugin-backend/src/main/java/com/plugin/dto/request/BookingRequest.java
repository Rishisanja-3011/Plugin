package com.plugin.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDateTime;
import java.math.BigDecimal;

@Data
public class BookingRequest {
    @NotNull
    private Long stationId;
    private Long chargingPointId; // nullable = virtual ETA booking or auto-assign
    private LocalDateTime startTime;
    @NotNull
    @Min(value = 1, message = "Duration must be at least 1 minute")
    @Max(value = 60, message = "Duration cannot exceed 60 minutes")
    private Integer durationMinutes;
    private String pointTypePreference; // FAST or SLOW, used if auto-assign
    private Double originLatitude;
    private Double originLongitude;
    private Boolean dynamicEta;
    @jakarta.validation.constraints.Size(max = 80)
    @jakarta.validation.constraints.Pattern(regexp = "[A-Za-z0-9_-]+")
    private String requestKey;
    private String chargingPreference;
    @jakarta.validation.constraints.DecimalMin("0.5")
    @jakarta.validation.constraints.DecimalMax("250")
    private BigDecimal requestedEnergyKwh;
}
