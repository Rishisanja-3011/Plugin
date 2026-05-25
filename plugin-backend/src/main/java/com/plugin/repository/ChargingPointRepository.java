package com.plugin.repository;

import com.plugin.entity.ChargingPoint;
import com.plugin.enums.PointStatus;
import com.plugin.enums.PointType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface ChargingPointRepository extends MongoRepository<ChargingPoint, String>, ChargingPointRepositoryCustom {
    java.util.Optional<ChargingPoint> findById(Long id);
    List<ChargingPoint> findByIdIn(List<Long> ids);
    List<ChargingPoint> findByStationId(Long stationId);
    List<ChargingPoint> findByStationIdIn(List<Long> stationIds);
    List<ChargingPoint> findByStationIdAndStatus(Long stationId, PointStatus status);
    List<ChargingPoint> findByStationIdAndPointType(Long stationId, PointType pointType);
    long countByStationId(Long stationId);
    long countByStationIdIn(List<Long> stationIds);
    long countByStationIdAndStatus(Long stationId, PointStatus status);
    long countByStationIdInAndStatus(List<Long> stationIds, PointStatus status);
    long countByStatus(PointStatus status);
    long countByStationManagerId(Long managerId);
    long countByStationManagerIdAndStatus(Long managerId, PointStatus status);

    @Query(value = "{ 'station.active': { $in: [true, 1] } }", count = true)
    long countByStationActiveTrue();

    @Query(value = "{ 'station.active': { $in: [true, 1] }, 'status': ?0 }", count = true)
    long countByStationActiveTrueAndStatus(PointStatus status);

    LocalDateTime findLatestUpdatedAtForActiveStations();
    LocalDateTime findLatestUpdatedAtForStationIds(List<Long> stationIds);
}
