package com.plugin.repository;

import com.plugin.entity.Station;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface StationRepositoryCustom {
    Page<Station> searchStations(String query, Pageable pageable);
}
