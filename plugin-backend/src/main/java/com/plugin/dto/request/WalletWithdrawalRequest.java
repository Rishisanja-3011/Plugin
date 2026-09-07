package com.plugin.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class WalletWithdrawalRequest {
    @NotNull
    @DecimalMin(value = "1.00", message = "Withdrawal amount must be at least Rs. 1.00")
    @DecimalMax(value = "15000.00", message = "Withdrawal amount cannot exceed Rs. 15000.00")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal amount;
}
