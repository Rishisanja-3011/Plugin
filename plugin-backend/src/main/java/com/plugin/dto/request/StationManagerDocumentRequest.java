package com.plugin.dto.request;

import com.plugin.enums.StationManagerBusinessDocumentType;
import lombok.Data;

@Data
public class StationManagerDocumentRequest {
    private StationManagerBusinessDocumentType documentType;
    private String referenceNumber;
    private String documentReference;
    private String notes;
}
