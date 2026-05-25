package com.plugin.entity;

import com.plugin.enums.PointType;
import com.plugin.enums.PricingModel;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "pricing")
@CompoundIndex(name = "uq_pricing_station_point_type", def = "{'station.id': 1, 'pointType': 1}", unique = true)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Pricing {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    private Station station;

    private Long stationId;

    private PointType pointType;

    private PricingModel pricingModel;

    private BigDecimal ratePerUnit;

    private String description;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
