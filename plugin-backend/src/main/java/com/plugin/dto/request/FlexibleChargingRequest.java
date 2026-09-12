package com.plugin.dto.request;

import com.plugin.enums.ChargingPreference;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class FlexibleChargingRequest {
    @NotNull @DecimalMin("0.5") @DecimalMax("250") private BigDecimal requiredEnergyKwh;
    @NotNull private LocalDateTime earliestStartTime;
    @NotNull private LocalDateTime readyBy;
    @DecimalMin("0") private BigDecimal maximumPricePerKwh;
    @DecimalMin("0") private BigDecimal maximumTravelDistanceKm;
    @DecimalMin("0") @DecimalMax("100") private BigDecimal minimumRenewableSharePercent;
    @DecimalMin("-90") @DecimalMax("90") private Double latitude;
    @DecimalMin("-180") @DecimalMax("180") private Double longitude;
    private ChargingPreference preference = ChargingPreference.BALANCED;
}
