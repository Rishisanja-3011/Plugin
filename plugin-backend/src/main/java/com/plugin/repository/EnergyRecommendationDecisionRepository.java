package com.plugin.repository;

import com.plugin.entity.EnergyRecommendationDecision;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface EnergyRecommendationDecisionRepository extends MongoRepository<EnergyRecommendationDecision, String> {
    List<EnergyRecommendationDecision> findTop20ByStationIdOrderByCreatedAtDesc(Long stationId);
}
