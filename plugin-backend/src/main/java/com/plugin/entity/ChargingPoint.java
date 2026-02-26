package com.plugin.entity;

import com.plugin.enums.PointStatus;
import com.plugin.enums.PointType;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "charging_points")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChargingPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String identifier;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "station_id", nullable = false)
    private Station station;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PointType pointType;

    @Column(nullable = false)
    private Double maxPowerKw;

    @Column(length = 50)
    private String connectorType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PointStatus status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = PointStatus.AVAILABLE;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
