package com.plugin.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SendOtpRequest {
    @NotBlank @Email @Size(max = 254)
    private String email;
    @NotBlank
    @Pattern(regexp = "(?i)EMAIL", message = "Only EMAIL OTP delivery is supported")
    private String deliveryMethod;

    public void setEmail(String email) {
        this.email = com.plugin.config.IdentityNormalizer.email(email);
    }
}
