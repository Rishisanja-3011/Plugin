package com.plugin.repository;

import com.plugin.entity.EnergyForecastRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface EnergyForecastRecordRepository extends MongoRepository<EnergyForecastRecord, String> {
    List<EnergyForecastRecord> findTop100ByGridRegionOrderByPredictedAtDesc(String gridRegion);
    List<EnergyForecastRecord> findTop50ByActualRenewableSharePercentIsNullAndTargetTimeBeforeOrderByTargetTimeAsc(LocalDateTime now);
}
