package com.plugin.repository;

import com.plugin.entity.ChargingPoint;
import com.plugin.enums.PointType;

import java.time.LocalDateTime;
import java.util.List;

public interface ChargingPointRepositoryCustom {
    LocalDateTime findLatestUpdatedAtForActiveStations();

    LocalDateTime findLatestUpdatedAtForStationIds(List<Long> stationIds);

    ChargingPoint reserveAvailablePoint(Long pointId, Long bookingId);

    ChargingPoint claimPointForSession(Long pointId, Long bookingId, Long sessionId);

    boolean releaseReservationForBooking(Long pointId, Long bookingId);

    boolean releasePointForSession(Long pointId, Long sessionId);

    void touchSchedule(Long pointId);
}
