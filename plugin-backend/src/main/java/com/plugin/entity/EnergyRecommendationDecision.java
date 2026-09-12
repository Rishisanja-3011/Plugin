package com.plugin.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "energyRecommendationDecisions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EnergyRecommendationDecision {
    @Id private String mongoId;
    @Indexed(unique = true, sparse = true) private Long id;
    @Indexed private Long stationId;
    private String gridRegion;
    private String action;
    private String recommendation;
    private String reason;
    private String actorEmail;
    private LocalDateTime createdAt;

    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
