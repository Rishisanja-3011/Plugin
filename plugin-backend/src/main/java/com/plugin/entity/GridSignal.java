package com.plugin.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.math.BigDecimal;

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
    private String status;
    private BigDecimal capacityLimitKw;
    private Integer incentivePercent;
    private BigDecimal expectedReductionKw;
    private BigDecimal achievedReductionKw;
    private Integer acceptedDrivers;
    private Integer deferredDrivers;
    private Integer declinedDrivers;
    private String actorEmail;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime closedAt;

    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = createdAt;
        if (status == null) status = "ACTIVE";
        if (acceptedDrivers == null) acceptedDrivers = 0;
        if (deferredDrivers == null) deferredDrivers = 0;
        if (declinedDrivers == null) declinedDrivers = 0;
    }
}
