package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.GridPoint;
import com.plugin.entity.EnergyForecastRecord;
import com.plugin.repository.EnergyForecastRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service @RequiredArgsConstructor @Slf4j
public class ForecastHistoryService {
    private final RenewableEnergyService energy;
    private final EnergyForecastRecordRepository records;
    @Value("${app.energy.history.region:IN-WE}") private String historyRegion;

    @Scheduled(initialDelayString = "${app.energy.history.initial-delay-ms:120000}",
            fixedDelayString = "${app.energy.history.capture-delay-ms:3600000}")
    public void captureAndReconcile() {
        try {
            List<GridPoint> outlook = energy.forecast(historyRegion, 7);
            GridPoint target = outlook.get(Math.min(6, outlook.size() - 1));
            records.save(EnergyForecastRecord.builder().gridRegion(target.getGridRegion())
                    .targetTime(target.getTimestamp()).predictedAt(LocalDateTime.now())
                    .predictedRenewableSharePercent(target.getRenewableSharePercent()).source(target.getSource())
                    .dataMode(target.getDataMode()).quality(target.getQuality()).sourceTimestamp(target.getSourceTimestamp()).build());
            for (EnergyForecastRecord record : records.findTop50ByActualRenewableSharePercentIsNullAndTargetTimeBeforeOrderByTargetTimeAsc(LocalDateTime.now())) {
                GridPoint actual = energy.current(record.getGridRegion());
                record.setActualRenewableSharePercent(actual.getRenewableSharePercent());
                record.setAbsoluteErrorPercent(actual.getRenewableSharePercent().subtract(record.getPredictedRenewableSharePercent()).abs());
                record.setReconciledAt(LocalDateTime.now()); records.save(record);
            }
        } catch (RuntimeException ex) {
            log.warn("Forecast history capture skipped because provider data is unavailable");
        }
    }

    public Map<String, Object> report(String region) {
        List<EnergyForecastRecord> history = records.findTop100ByGridRegionOrderByPredictedAtDesc(region);
        double mae = history.stream().filter(r -> r.getAbsoluteErrorPercent() != null)
                .mapToDouble(r -> r.getAbsoluteErrorPercent().doubleValue()).average().orElse(0);
        long reconciled = history.stream().filter(r -> r.getAbsoluteErrorPercent() != null).count();
        return Map.of("gridRegion", region, "records", history, "reconciledRecords", reconciled,
                "meanAbsoluteErrorPercent", BigDecimal.valueOf(mae).setScale(2, RoundingMode.HALF_UP),
                "accuracyPercent", BigDecimal.valueOf(Math.max(0, 100 - mae)).setScale(2, RoundingMode.HALF_UP),
                "methodology", "Prediction is compared with the provider observation available after the target time; cached and simulated modes remain labelled.");
    }
}
