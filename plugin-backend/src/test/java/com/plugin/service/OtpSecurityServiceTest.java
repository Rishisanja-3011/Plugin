package com.plugin.service;

import com.plugin.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OtpSecurityServiceTest {

    private static final String TEST_PEPPER = "unit-test-otp-pepper-that-is-at-least-thirty-two-bytes";

    @Test
    void hashesOtpWithAccountAndPurposeContext() {
        OtpSecurityService service = new OtpSecurityService(TEST_PEPPER, 5, 60);

        String first = service.hash("user@example.test", "PASSWORD_RESET", "123456");
        String secondAccount = service.hash("other@example.test", "PASSWORD_RESET", "123456");
        String secondPurpose = service.hash("user@example.test", "DELETE_ACCOUNT", "123456");

        assertThat(first).doesNotContain("123456");
        assertThat(first).isNotEqualTo(secondAccount).isNotEqualTo(secondPurpose);
        assertThat(service.matches(first, "user@example.test", "PASSWORD_RESET", "123456")).isTrue();
        assertThat(service.matches(first, "user@example.test", "PASSWORD_RESET", "654321")).isFalse();
    }

    @Test
    void enforcesResendCooldown() {
        OtpSecurityService service = new OtpSecurityService(TEST_PEPPER, 5, 60);
        LocalDateTime now = LocalDateTime.now();

        assertThatThrownBy(() -> service.enforceResendCooldown(now.minusSeconds(10), now))
                .isInstanceOf(BadRequestException.class);
        service.enforceResendCooldown(now.minusSeconds(61), now);
    }

    @Test
    void rejectsWeakPepperAndUnsafeLimits() {
        assertThatThrownBy(() -> new OtpSecurityService("short", 5, 60))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new OtpSecurityService(TEST_PEPPER, 0, 60))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new OtpSecurityService(TEST_PEPPER, 5, 0))
                .isInstanceOf(IllegalStateException.class);
    }
}
