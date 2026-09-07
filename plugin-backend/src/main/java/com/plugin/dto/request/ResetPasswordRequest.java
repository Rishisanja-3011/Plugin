package com.plugin.dto.request;

import com.plugin.config.PasswordPolicy;
import com.plugin.validation.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResetPasswordRequest {
    @NotBlank @Email @Size(max = 254)
    private String email;
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

    public void setEmail(String email) {
        this.email = com.plugin.config.IdentityNormalizer.email(email);
    }
}
