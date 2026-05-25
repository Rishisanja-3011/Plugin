package com.plugin.repository;

import java.time.LocalDateTime;
import java.util.List;

public interface ChargingPointRepositoryCustom {
    LocalDateTime findLatestUpdatedAtForActiveStations();

    LocalDateTime findLatestUpdatedAtForStationIds(List<Long> stationIds);
}
