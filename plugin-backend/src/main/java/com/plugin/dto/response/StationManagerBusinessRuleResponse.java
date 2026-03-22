package com.plugin.dto.response;

import com.plugin.enums.StationManagerBusinessDocumentType;
import com.plugin.enums.StationManagerBusinessType;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class StationManagerBusinessRuleResponse {
    private StationManagerBusinessType businessType;
    private String heading;
    private String description;
    private int minimumRequiredDocuments;
    private List<StationManagerBusinessDocumentType> requiredDocuments;
    private List<StationManagerBusinessDocumentType> optionalDocuments;
}
