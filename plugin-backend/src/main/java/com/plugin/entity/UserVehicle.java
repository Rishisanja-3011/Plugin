package com.plugin.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_vehicles", uniqueConstraints = {
        @UniqueConstraint(name = "uq_user_vehicle_registration", columnNames = {"user_id", "vehicle_registration"})
}, indexes = {
        @Index(name = "idx_vehicle_user", columnList = "user_id"),
        @Index(name = "idx_vehicle_active", columnList = "active")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserVehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "vehicle_make", nullable = false, length = 50)
    private String vehicleMake;

    @Column(name = "vehicle_model", nullable = false, length = 50)
    private String vehicleModel;

    @Column(name = "vehicle_registration", nullable = false, length = 20)
    private String vehicleRegistration;

    @Column(nullable = false)
    private Boolean active;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (active == null) {
            active = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
