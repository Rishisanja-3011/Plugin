package com.plugin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalTime;

@Data
public class StationRequest {
    @NotBlank
    private String name;
    @NotBlank
    private String address;
    private String city;
    private String state;
    private String pincode;
    private String contactPhone;
    private String contactEmail;
    @NotNull
    @jakarta.validation.constraints.DecimalMin("-90.0")
    @jakarta.validation.constraints.DecimalMax("90.0")
    private Double latitude;
    @NotNull
    @jakarta.validation.constraints.DecimalMin("-180.0")
    @jakarta.validation.constraints.DecimalMax("180.0")
    private Double longitude;
    @NotNull
    private LocalTime openingTime;
    @NotNull
    private LocalTime closingTime;
}
