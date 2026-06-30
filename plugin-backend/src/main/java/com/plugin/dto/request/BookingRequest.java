package com.plugin.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDateTime;

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
}
