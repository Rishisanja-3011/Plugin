package com.plugin.repository;

import com.plugin.entity.StationManager;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface StationManagerRepository extends MongoRepository<StationManager, String> {
    Optional<StationManager> findByApplicationId(Long applicationId);
    void deleteByApplicationId(Long applicationId);
}
