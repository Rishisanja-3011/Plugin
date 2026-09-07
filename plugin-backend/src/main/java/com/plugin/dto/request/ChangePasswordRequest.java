package com.plugin.dto.request;

import com.plugin.config.PasswordPolicy;
import com.plugin.validation.StrongPassword;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ChangePasswordRequest {
    @NotBlank
    @Size(max = PasswordPolicy.LEGACY_LOGIN_MAX_LENGTH)
    private String currentPassword;
    @NotBlank
    @jakarta.validation.constraints.Pattern(regexp = "[0-9]{6}", message = "OTP must be exactly 6 digits")
    private String otp;
    @NotBlank
    @StrongPassword
    @Size(min = PasswordPolicy.MIN_LENGTH, max = PasswordPolicy.MAX_LENGTH,
            message = PasswordPolicy.NEW_PASSWORD_MESSAGE)
    private String newPassword;
    @NotBlank
    @StrongPassword
    @Size(min = PasswordPolicy.MIN_LENGTH, max = PasswordPolicy.MAX_LENGTH,
            message = PasswordPolicy.NEW_PASSWORD_MESSAGE)
    private String confirmPassword;
}
