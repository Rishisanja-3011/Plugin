package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class StationManagerReferenceDataResponse {
    private List<StationManagerBusinessRuleResponse> businessRules;
}
