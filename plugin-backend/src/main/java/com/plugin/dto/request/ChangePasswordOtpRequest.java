package com.plugin.dto.request;

import com.plugin.config.PasswordPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ChangePasswordOtpRequest {
    @NotBlank
    @Size(max = PasswordPolicy.LEGACY_LOGIN_MAX_LENGTH)
    private String currentPassword;
}
