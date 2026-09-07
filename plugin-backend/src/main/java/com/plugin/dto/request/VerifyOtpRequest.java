package com.plugin.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VerifyOtpRequest {
    @NotBlank @Email @Size(max = 254)
    private String email;
    @NotBlank
    @jakarta.validation.constraints.Pattern(regexp = "[0-9]{6}", message = "OTP must be exactly 6 digits")
    private String otp;

    public void setEmail(String email) {
        this.email = com.plugin.config.IdentityNormalizer.email(email);
    }
}
