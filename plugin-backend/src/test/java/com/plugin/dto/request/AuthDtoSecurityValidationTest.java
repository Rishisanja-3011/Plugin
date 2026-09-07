package com.plugin.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AuthDtoSecurityValidationTest {

    @Test
    void everyAuthEmailIsBoundedAndCanonicalizedBeforeValidation() throws Exception {
        List<Class<?>> emailDtos = List.of(
                ConfirmRegistrationOtpRequest.class,
                ForgotPasswordRequest.class,
                LoginRequest.class,
                RegisterRequest.class,
                ResendRegistrationOtpRequest.class,
                ResetPasswordRequest.class,
                SendOtpRequest.class,
                VerifyOtpRequest.class
        );

        for (Class<?> dtoType : emailDtos) {
            Field email = dtoType.getDeclaredField("email");
            assertThat(email.getAnnotation(Size.class).max()).isEqualTo(254);
            Object dto = dtoType.getConstructor().newInstance();
            Method setter = dtoType.getMethod("setEmail", String.class);
            Method getter = dtoType.getMethod("getEmail");
            setter.invoke(dto, " Person@Example.Test ");
            assertThat(getter.invoke(dto)).isEqualTo("person@example.test");
        }
    }

    @Test
    void everyOtpFieldRequiresExactlySixAsciiDigits() throws Exception {
        List<Class<?>> otpDtos = List.of(
                ChangePasswordRequest.class,
                ConfirmRegistrationOtpRequest.class,
                DeleteAccountRequest.class,
                ForgotChangePasswordRequest.class,
                ForgotDeleteAccountRequest.class,
                ResetPasswordRequest.class,
                VerifyChangePasswordOtpRequest.class,
                VerifyDeleteAccountOtpRequest.class,
                VerifyOtpRequest.class
        );

        for (Class<?> dtoType : otpDtos) {
            Pattern pattern = dtoType.getDeclaredField("otp").getAnnotation(Pattern.class);
            assertThat(pattern).as(dtoType.getSimpleName()).isNotNull();
            assertThat(pattern.regexp()).isEqualTo("[0-9]{6}");
            assertThat("123456".matches(pattern.regexp())).isTrue();
            assertThat("١٢٣٤٥٦".matches(pattern.regexp())).isFalse();
        }
    }

    @Test
    void registrationPhoneIsBounded() throws Exception {
        Size size = RegisterRequest.class.getDeclaredField("phone").getAnnotation(Size.class);
        assertThat(size).isNotNull();
        assertThat(size.max()).isEqualTo(32);
    }
}
