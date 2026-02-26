package com.plugin.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class BookingRequest {
    @NotNull
    private Long stationId;
    private Long chargingPointId; // nullable = auto-assign
    @NotNull
    private LocalDateTime startTime;
    @NotNull
    private Integer durationMinutes;
    private String pointTypePreference; // FAST or SLOW, used if auto-assign
}
