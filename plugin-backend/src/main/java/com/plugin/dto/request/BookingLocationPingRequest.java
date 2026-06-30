package com.plugin.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class BookingLocationPingRequest {
    @NotNull
    @DecimalMin(value = "-90.0", message = "Latitude is invalid")
    @DecimalMax(value = "90.0", message = "Latitude is invalid")
    private Double latitude;

    @NotNull
    @DecimalMin(value = "-180.0", message = "Longitude is invalid")
    @DecimalMax(value = "180.0", message = "Longitude is invalid")
    private Double longitude;
}
