package com.plugin.dto.request;

import com.plugin.config.PasswordPolicy;
import com.plugin.validation.StrongPassword;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class StationManagerAccessSetupRequest {

    @NotBlank
    @Size(min = 32, max = 512)
    private String token;

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
