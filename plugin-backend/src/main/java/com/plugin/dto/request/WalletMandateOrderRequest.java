package com.plugin.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter @Setter
public class WalletMandateOrderRequest {

    @NotBlank
    @Size(max = 32)
    @Pattern(regexp = "(?i)^(card|upi|emandate)$")
    private String method;

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
