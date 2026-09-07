package com.plugin.dto.request;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class WalletRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsFractionalSubunitsAndOversizedWithdrawal() {
        WalletTopUpOrderRequest topUp = new WalletTopUpOrderRequest();
        topUp.setAmount(new BigDecimal("1000.001"));
        WalletWithdrawalRequest withdrawal = new WalletWithdrawalRequest();
        withdrawal.setAmount(new BigDecimal("15000.01"));

        assertThat(validator.validate(topUp)).isNotEmpty();
        assertThat(validator.validate(withdrawal)).isNotEmpty();
    }

    @Test
    void rejectsUnknownMandateMethodAndOversizedProviderIdentifiers() {
        WalletMandateOrderRequest mandate = new WalletMandateOrderRequest();
        mandate.setMethod("cash");
        mandate.setThresholdAmount(new BigDecimal("200.00"));
        mandate.setTopUpAmount(new BigDecimal("1000.00"));
        WalletPaymentVerificationRequest verification = new WalletPaymentVerificationRequest();
        verification.setRazorpayOrderId("o".repeat(129));
        verification.setRazorpayPaymentId("p".repeat(129));
        verification.setRazorpaySignature("s".repeat(257));

        assertThat(validator.validate(mandate)).isNotEmpty();
        assertThat(validator.validate(verification)).hasSize(3);
    }
}
