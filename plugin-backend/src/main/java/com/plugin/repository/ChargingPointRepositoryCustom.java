package com.plugin.repository;

import com.plugin.entity.ChargingPoint;
import com.plugin.enums.PointType;

import java.time.LocalDateTime;
import java.util.List;

public interface ChargingPointRepositoryCustom {
    LocalDateTime findLatestUpdatedAtForActiveStations();

    LocalDateTime findLatestUpdatedAtForStationIds(List<Long> stationIds);

    ChargingPoint lockAvailablePointForStation(Long stationId, PointType pointType);
}
