package com.plugin.repository;

import com.plugin.entity.GridSignal;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface GridSignalRepository extends MongoRepository<GridSignal, String> {
    java.util.Optional<GridSignal> findById(Long id);
    List<GridSignal> findTop20ByGridRegionOrderByCreatedAtDesc(String gridRegion);
}
