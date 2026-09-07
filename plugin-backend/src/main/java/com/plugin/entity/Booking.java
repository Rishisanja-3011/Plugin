package com.plugin.entity;

import com.plugin.enums.BookingStatus;
import com.plugin.enums.RescheduleRequestStatus;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "bookings")
@CompoundIndexes({
        @CompoundIndex(name = "idx_booking_point_time", def = "{'chargingPoint.id': 1, 'startTime': 1, 'endTime': 1}"),
        @CompoundIndex(name = "idx_booking_point_id_time", def = "{'chargingPointId': 1, 'startTime': 1, 'endTime': 1}"),
        @CompoundIndex(name = "idx_booking_created_desc", def = "{'createdAt': -1}"),
        @CompoundIndex(name = "idx_booking_status_created_desc", def = "{'status': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "idx_booking_customer_created_desc", def = "{'customerId': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "idx_booking_station_created_desc", def = "{'stationId': 1, 'createdAt': -1}")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Booking {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    @Indexed(unique = true)
    private String referenceId;

    @Version
    private Long version;

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

    private LocalDateTime reservedUntil;
    private LocalDateTime holdExpiresAt;
    private Boolean etaLiveTraffic;
    private String requestKey;
    private String requestFingerprint;

    private Integer requestedDurationMinutes;

    private Double originLatitude;

    private Double originLongitude;

    private Double lastKnownLatitude;

    private Double lastKnownLongitude;

    private LocalDateTime lastLocationPingAt;

    private LocalDateTime predictedArrivalAt;

    private LocalDateTime gracePeriodEndTime;

    private Long etaSeconds;

    private Double lastDistanceMeters;

    private Boolean proximityLocked;

    private Long assignedChargingPointId;

    private Boolean virtualSpot;

    private String pointTypePreference;

    private BigDecimal lockedRatePerUnit;

    private String lockedRateType;

    private BookingStatus status;

    private Boolean startNotificationSent;

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
        if (startNotificationSent == null) startNotificationSent = false;
        if (rescheduleRequestStatus == null) rescheduleRequestStatus = RescheduleRequestStatus.NONE;
        if (proximityLocked == null) proximityLocked = false;
        if (virtualSpot == null) virtualSpot = false;
    }

    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
