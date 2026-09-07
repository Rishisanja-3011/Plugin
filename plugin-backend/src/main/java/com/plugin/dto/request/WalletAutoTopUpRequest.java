package com.plugin.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter @Setter
public class WalletAutoTopUpRequest {

    private boolean enabled;

    @NotNull
    @DecimalMin("1.00")
    @DecimalMax("15000.00")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal thresholdAmount;

    @NotNull
    @DecimalMin("1000.00")
    @DecimalMax("15000.00")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal topUpAmount;
}
