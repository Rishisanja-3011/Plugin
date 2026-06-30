package com.plugin.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter @Setter
public class WalletMandateOrderRequest {

    @NotBlank
    private String method;

    @NotNull
    @DecimalMin("1.00")
    @DecimalMax("15000.00")
    private BigDecimal thresholdAmount;

    @NotNull
    @DecimalMin("1000.00")
    @DecimalMax("15000.00")
    private BigDecimal topUpAmount;
}
