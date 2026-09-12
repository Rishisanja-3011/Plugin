package com.plugin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalTime;
import java.time.LocalDateTime;

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
    @jakarta.validation.constraints.DecimalMin("0.0")
    private Double localSolarCurrentKw;
    @jakarta.validation.constraints.DecimalMin("0.0")
    private Double localSolarForecastKw;
    @jakarta.validation.constraints.DecimalMin("0.0")
    private Double batteryCapacityKwh;
    @jakarta.validation.constraints.DecimalMin("0.0")
    @jakarta.validation.constraints.DecimalMax("100.0")
    private Double batteryStateOfChargePercent;
    @jakarta.validation.constraints.DecimalMin("0.0")
    private Double gridImportLimitKw;
    @jakarta.validation.constraints.DecimalMin("0.0")
    @jakarta.validation.constraints.DecimalMax("100.0")
    private Double emergencyReservePercent;
    @jakarta.validation.constraints.DecimalMin("0.0")
    private Double renewableAvailableForChargingKw;
    @jakarta.validation.constraints.DecimalMin("0.0")
    @jakarta.validation.constraints.DecimalMax("100.0")
    private Double stationUtilizationPercent;
    private String renewableDataMode;
    private LocalDateTime energyUpdatedAt;
    @jakarta.validation.constraints.DecimalMin("0.0")
    private Double minimumRatePerKwh;
    @jakarta.validation.constraints.DecimalMin("0.0")
    @jakarta.validation.constraints.DecimalMax("100.0")
    private Double maximumDiscountPercent;
}
