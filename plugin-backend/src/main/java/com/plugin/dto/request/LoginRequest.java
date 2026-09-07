package com.plugin.dto.request;

import com.plugin.config.PasswordPolicy;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank @Email @Size(max = 254)
    private String email;
    @NotBlank
    @Size(max = PasswordPolicy.LEGACY_LOGIN_MAX_LENGTH)
    private String password;

    public void setEmail(String email) {
        this.email = com.plugin.config.IdentityNormalizer.email(email);
    }
}
