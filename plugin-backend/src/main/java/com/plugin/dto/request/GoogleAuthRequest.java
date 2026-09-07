package com.plugin.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class GoogleAuthRequest {
    @Size(max = 8192)
    private String idToken;

    @Size(max = 8192)
    private String accessToken;
}
