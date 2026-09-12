package com.plugin.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "energyForecastRecords")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EnergyForecastRecord {
    @Id private String id;
    @Indexed private String gridRegion;
    @Indexed private LocalDateTime targetTime;
    private LocalDateTime predictedAt;
    private BigDecimal predictedRenewableSharePercent;
    private BigDecimal actualRenewableSharePercent;
    private BigDecimal absoluteErrorPercent;
    private String source;
    private String dataMode;
    private String quality;
    private LocalDateTime sourceTimestamp;
    private LocalDateTime reconciledAt;
}
