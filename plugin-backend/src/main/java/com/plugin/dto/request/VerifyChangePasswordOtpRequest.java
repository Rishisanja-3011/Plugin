package com.plugin.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VerifyChangePasswordOtpRequest {
    @NotBlank
    @jakarta.validation.constraints.Pattern(regexp = "[0-9]{6}", message = "OTP must be exactly 6 digits")
    private String otp;
}
