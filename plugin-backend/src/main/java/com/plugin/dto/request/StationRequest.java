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
    private Double latitude;
    private Double longitude;
    @NotNull
    private LocalTime openingTime;
    @NotNull
    private LocalTime closingTime;
}
