package com.plugin.dto.request;

import com.plugin.enums.StationManagerBusinessDocumentType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class StationManagerDocumentRequest {
    @NotNull
    private StationManagerBusinessDocumentType documentType;

    @Size(max = 100)
    private String referenceNumber;

    @Size(max = 200)
    private String documentReference;

    @Size(max = 500)
    private String notes;
}
