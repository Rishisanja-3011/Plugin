package com.plugin.entity;

import com.plugin.enums.PointStatus;
import com.plugin.enums.PointType;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "chargingPoints")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChargingPoint {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    @Indexed(unique = true)
    private String identifier;

    private Station station;

    private Long stationId;

    private PointType pointType;

    private Double maxPowerKw;

    private String connectorType;

    private PointStatus status;

    /** Booking that owns a live proximity reservation, if any. */
    private Long reservedByBookingId;

    /** Session that currently owns the connector, if any. */
    private Long activeSessionId;

    /** Incremented whenever the future booking schedule is changed. */
    private Long scheduleRevision;

    @Version
    private Long version;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = PointStatus.AVAILABLE;
    }

    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
