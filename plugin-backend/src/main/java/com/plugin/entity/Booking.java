package com.plugin.entity;

import com.plugin.enums.BookingStatus;
import com.plugin.enums.RescheduleRequestStatus;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "bookings")
@CompoundIndex(name = "idx_booking_point_time", def = "{'chargingPoint.id': 1, 'startTime': 1, 'endTime': 1}")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Booking {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    @Indexed(unique = true)
    private String referenceId;

    private User customer;

    private Long customerId;

    private Station station;

    private Long stationId;

    private ChargingPoint chargingPoint;

    private Long chargingPointId;

    private UserVehicle vehicle;

    private Long vehicleId;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private BigDecimal lockedRatePerUnit;

    private String lockedRateType;

    private BookingStatus status;

    private String cancellationReason;

    private RescheduleRequestStatus rescheduleRequestStatus;

    private LocalDateTime rescheduleRequestedStartTime;

    private LocalDateTime rescheduleRequestedEndTime;

    private String rescheduleRequestReason;

    private LocalDateTime rescheduleRequestedAt;

    private LocalDateTime rescheduleReviewedAt;

    private String rescheduleReviewedBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = BookingStatus.CONFIRMED;
        if (rescheduleRequestStatus == null) rescheduleRequestStatus = RescheduleRequestStatus.NONE;
    }

    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
