package com.plugin.dto.request;

import com.plugin.config.PasswordPolicy;
import com.plugin.validation.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank @Size(min = 2, max = 100)
    private String fullName;

    @NotBlank @Email @Size(max = 254)
    private String email;

    @NotBlank
    @StrongPassword
    @Size(min = PasswordPolicy.MIN_LENGTH, max = PasswordPolicy.MAX_LENGTH,
            message = PasswordPolicy.NEW_PASSWORD_MESSAGE)
    private String password;

    @Size(max = 32)
    private String phone;

    public void setEmail(String email) {
        this.email = com.plugin.config.IdentityNormalizer.email(email);
    }
}
