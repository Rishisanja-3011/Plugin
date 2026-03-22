package com.plugin.dto.response;

import com.plugin.enums.StationManagerBusinessDocumentType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StationManagerDocumentResponse {
    private Long id;
    private StationManagerBusinessDocumentType documentType;
    private String referenceNumber;
    private String documentReference;
    private String notes;
}
