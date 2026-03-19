package com.plugin.repository;

import com.plugin.entity.ChargingPoint;
import com.plugin.enums.PointStatus;
import com.plugin.enums.PointType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface ChargingPointRepository extends JpaRepository<ChargingPoint, Long> {
    List<ChargingPoint> findByStationId(Long stationId);
    List<ChargingPoint> findByStationIdAndStatus(Long stationId, PointStatus status);
    List<ChargingPoint> findByStationIdAndPointType(Long stationId, PointType pointType);
    long countByStationId(Long stationId);
    long countByStationIdAndStatus(Long stationId, PointStatus status);
    long countByStatus(PointStatus status);

    long countByStationActiveTrue();
    long countByStationActiveTrueAndStatus(PointStatus status);

    @Query("SELECT MAX(cp.updatedAt) FROM ChargingPoint cp WHERE cp.station.active = true")
    LocalDateTime findLatestUpdatedAtForActiveStations();
}
