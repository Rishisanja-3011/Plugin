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

    @DecimalMin("0") @DecimalMax("100")
    private BigDecimal minimumRenewableSharePercent;
    @DecimalMin("0")
    private BigDecimal maximumPricePerKwh;
    @DecimalMin("0") @DecimalMax("100")
    private BigDecimal batterySocPercent;
    @DecimalMin("0") @DecimalMax("100")
    private BigDecimal targetSocPercent;
    @Positive
    private Integer maximumWaitMinutes;

    @com.fasterxml.jackson.annotation.JsonIgnore private BigDecimal stationLocalRenewableKw;
    @com.fasterxml.jackson.annotation.JsonIgnore private BigDecimal stationBatteryDischargeKw;
    @com.fasterxml.jackson.annotation.JsonIgnore private BigDecimal gridImportLimitKw;
    @com.fasterxml.jackson.annotation.JsonIgnore private BigDecimal stationUtilizationPercent;
    @com.fasterxml.jackson.annotation.JsonIgnore private BigDecimal minimumRatePerKwh;
    @com.fasterxml.jackson.annotation.JsonIgnore private BigDecimal maximumDiscountPercent;
    @com.fasterxml.jackson.annotation.JsonIgnore private String stationEnergyDataMode;
}
