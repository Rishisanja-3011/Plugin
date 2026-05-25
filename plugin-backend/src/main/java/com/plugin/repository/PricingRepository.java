package com.plugin.repository;

import com.plugin.entity.Pricing;
import com.plugin.enums.PointType;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface PricingRepository extends MongoRepository<Pricing, String> {
    Optional<Pricing> findById(Long id);
    List<Pricing> findByStationId(Long stationId);
    List<Pricing> findByStationIdIn(List<Long> stationIds);
    List<Pricing> findByStationManagerId(Long managerId);
    Optional<Pricing> findByStationIdAndPointType(Long stationId, PointType pointType);
}
