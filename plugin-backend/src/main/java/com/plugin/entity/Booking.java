package com.plugin.entity;

import com.plugin.enums.BookingStatus;
import com.plugin.enums.RescheduleRequestStatus;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings", indexes = {
    @Index(name = "idx_booking_point_time", columnList = "charging_point_id, start_time, end_time")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String referenceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "station_id", nullable = false)
    private Station station;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "charging_point_id", nullable = false)
    private ChargingPoint chargingPoint;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id")
    private UserVehicle vehicle;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Column(precision = 10, scale = 2)
    private BigDecimal lockedRatePerUnit;

    @Column(length = 15)
    private String lockedRateType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private BookingStatus status;

    @Column(length = 500)
    private String cancellationReason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RescheduleRequestStatus rescheduleRequestStatus;

    private LocalDateTime rescheduleRequestedStartTime;

    private LocalDateTime rescheduleRequestedEndTime;

    @Column(length = 500)
    private String rescheduleRequestReason;

    private LocalDateTime rescheduleRequestedAt;

    private LocalDateTime rescheduleReviewedAt;

    @Column(length = 150)
    private String rescheduleReviewedBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = BookingStatus.CONFIRMED;
        if (rescheduleRequestStatus == null) rescheduleRequestStatus = RescheduleRequestStatus.NONE;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
