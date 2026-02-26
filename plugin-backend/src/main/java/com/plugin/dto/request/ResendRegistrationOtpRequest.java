package com.plugin.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResendRegistrationOtpRequest {
    @NotBlank
    @Email
    private String email;
}
