package com.plugin.service;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RazorpayPaymentServiceSecurityTest {

    @Test
    void productionRejectsTestCredentials() {
        RazorpayPaymentService service = configuredService(true, "rzp_test_example", "test-secret");

        assertThrows(IllegalStateException.class, service::validateProductionConfiguration);
    }

    @Test
    void developmentKeepsRazorpayTestModeAvailable() {
        RazorpayPaymentService service = configuredService(false, "rzp_test_example", "test-secret");

        assertDoesNotThrow(service::validateProductionConfiguration);
    }

    private RazorpayPaymentService configuredService(boolean production, String keyId, String keySecret) {
        RazorpayPaymentService service = new RazorpayPaymentService();
        ReflectionTestUtils.setField(service, "productionMode", production);
        ReflectionTestUtils.setField(service, "keyId", keyId);
        ReflectionTestUtils.setField(service, "keySecret", keySecret);
        return service;
    }
}
