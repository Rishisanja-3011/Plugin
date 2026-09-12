package com.plugin.dto.request;

import com.plugin.enums.ChargingPreference;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class ChargingOptionsRequest {
    @NotNull
    @Positive
    private Long stationId;
    private Long chargingPointId;

    @com.fasterxml.jackson.annotation.JsonIgnore
    private BigDecimal stationTariff;

    private String gridRegion = "IN-WE";

    @NotNull
    @DecimalMin("0.5")
    @DecimalMax("250")
    private BigDecimal requiredEnergyKwh;

    @NotNull
    private LocalDateTime earliestStartTime;

    @NotNull
    private LocalDateTime latestEndTime;

    @NotNull
    @DecimalMin("1.0")
    @DecimalMax("500")
    private BigDecimal chargerPowerKw;

    @NotNull
    @DecimalMin("1.0")
    @DecimalMax("5000")
    private BigDecimal stationAvailableCapacityKw;

    private ChargingPreference preference = ChargingPreference.BALANCED;
}
