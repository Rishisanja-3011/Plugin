package com.plugin.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "gridSignals")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GridSignal {
    @Id private String mongoId;
    @Indexed(unique = true, sparse = true) private Long id;
    @Indexed private String gridRegion;
    private String signalType;
    private Integer requestedReductionPercent;
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    private String message;
    private boolean cancelled;
    private String actorEmail;
    private LocalDateTime createdAt;

    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
