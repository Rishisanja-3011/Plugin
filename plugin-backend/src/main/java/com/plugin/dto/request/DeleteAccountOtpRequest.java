package com.plugin.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DeleteAccountOtpRequest {
    @NotBlank
    private String password;
}
