package com.plugin.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VerifyChangePasswordOtpRequest {
    @NotBlank
    private String otp;
}
