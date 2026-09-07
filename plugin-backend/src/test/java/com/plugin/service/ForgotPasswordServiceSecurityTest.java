package com.plugin.service;

import com.plugin.dto.request.ResetPasswordRequest;
import com.plugin.dto.request.SendOtpRequest;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.PasswordResetOtpRepository;
import com.plugin.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForgotPasswordServiceSecurityTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordResetOtpRepository otpRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private OtpSecurityService otpSecurityService;
    @Mock private MongoTemplate mongoTemplate;

    @Test
    void accountCheckDoesNotReadOrRevealStoredAccountData() {
        ForgotPasswordService service = service();

        Map<String, Object> response = service.checkEmail("Person@Example.Test");

        assertThat(response).containsEntry("hasPhone", false);
        assertThat(response.get("message").toString()).startsWith("If an active account exists");
        assertThat(response.get("maskedEmail")).isEqualTo("p****n@example.test");
        verifyNoInteractions(userRepository);
    }

    @Test
    void unknownAccountGetsSameGenericDeliveryContract() {
        when(userRepository.findByEmailIgnoreCase("missing@example.test")).thenReturn(Optional.empty());
        SendOtpRequest request = new SendOtpRequest();
        request.setEmail("missing@example.test");
        request.setDeliveryMethod("EMAIL");

        Map<String, String> response = service().sendOtp(request);

        assertThat(response).containsEntry("delivered", "true");
        assertThat(response.get("message")).startsWith("If an active account exists");
        verifyNoInteractions(otpRepository, mongoTemplate);
    }

    @Test
    void rejectsUnsupportedPhoneDeliveryBeforeAccountLookup() {
        SendOtpRequest request = new SendOtpRequest();
        request.setEmail("person@example.test");
        request.setDeliveryMethod("PHONE");

        assertThatThrownBy(() -> service().sendOtp(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Only EMAIL OTP delivery is supported");
        verifyNoInteractions(userRepository);
    }

    @Test
    void resetUsesGenericFailureForUnknownAccount() {
        when(userRepository.findByEmailIgnoreCase("missing@example.test")).thenReturn(Optional.empty());
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setEmail("missing@example.test");
        request.setOtp("123456");
        request.setNewPassword("long-enough-password");
        request.setConfirmPassword("long-enough-password");

        assertThatThrownBy(() -> service().resetPassword(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Unable to reset password with the supplied credentials");
    }

    private ForgotPasswordService service() {
        return new ForgotPasswordService(
                userRepository, otpRepository, passwordEncoder, otpSecurityService, mongoTemplate);
    }
}
