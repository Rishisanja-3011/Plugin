package com.plugin.dto.request;

import com.plugin.config.PasswordPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class DeleteAccountRequest {
    @NotBlank
    @Size(max = PasswordPolicy.LEGACY_LOGIN_MAX_LENGTH)
    private String password;
    @NotBlank
    @jakarta.validation.constraints.Pattern(regexp = "[0-9]{6}", message = "OTP must be exactly 6 digits")
    private String otp;
}
