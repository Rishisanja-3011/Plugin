package com.plugin.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class StationManagerCredentialIssueRequest {

    @NotBlank
    @Email
    @Pattern(
            regexp = "^[A-Za-z0-9._%+-]+@plugin\\.com$",
            message = "Portal login email must end with @plugin.com."
    )
    @Size(max = 254)
    private String portalLoginEmail;
}
