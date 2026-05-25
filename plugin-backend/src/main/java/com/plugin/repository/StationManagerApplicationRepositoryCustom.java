package com.plugin.repository;

import com.plugin.entity.StationManagerApplication;
import com.plugin.enums.StationManagerApplicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface StationManagerApplicationRepositoryCustom {
    Page<StationManagerApplication> search(StationManagerApplicationStatus status,
                                           String query,
                                           boolean linkedStationOnly,
                                           Pageable pageable);
}
