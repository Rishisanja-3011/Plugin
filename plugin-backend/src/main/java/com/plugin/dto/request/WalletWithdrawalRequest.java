package com.plugin.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class WalletWithdrawalRequest {
    @NotNull
    @DecimalMin(value = "1.00", message = "Withdrawal amount must be at least Rs. 1.00")
    private BigDecimal amount;
}
