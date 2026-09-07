package com.plugin.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResendRegistrationOtpRequest {
    @NotBlank
    @Email
    @Size(max = 254)
    private String email;

    public void setEmail(String email) {
        this.email = com.plugin.config.IdentityNormalizer.email(email);
    }
}
