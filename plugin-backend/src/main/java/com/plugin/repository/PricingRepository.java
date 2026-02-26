package com.plugin.repository;

import com.plugin.entity.Pricing;
import com.plugin.enums.PointType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PricingRepository extends JpaRepository<Pricing, Long> {
    List<Pricing> findByStationId(Long stationId);
    Optional<Pricing> findByStationIdAndPointType(Long stationId, PointType pointType);
}
