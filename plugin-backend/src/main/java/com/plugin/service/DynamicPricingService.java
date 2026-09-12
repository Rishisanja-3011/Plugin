package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.GridPoint;
import com.plugin.entity.GridSignal;
import com.plugin.entity.Station;
import com.plugin.repository.GridSignalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DynamicPricingService {
    private final RenewableEnergyService energyService;
    private final GridSignalRepository gridSignalRepository;

    @Value("${app.energy.pricing.renewable-discount-factor:0.30}") private double renewableDiscountFactor;
    @Value("${app.energy.pricing.maximum-renewable-discount-percent:30}") private double maxRenewableDiscount;
    @Value("${app.energy.pricing.maximum-total-discount-percent:40}") private double maxTotalDiscount;
    @Value("${app.energy.pricing.minimum-rate-per-kwh:1}") private double minimumRate;
    @Value("${app.energy.pricing.low-utilization-threshold-percent:35}") private double lowUtilizationThreshold;
    @Value("${app.energy.pricing.low-utilization-incentive-percent:3}") private double lowUtilizationIncentive;
    @Value("${app.energy.pricing.congestion-threshold-percent:85}") private double congestionThreshold;
    @Value("${app.energy.pricing.congestion-adjustment-percent:5}") private double congestionAdjustment;

    public record DynamicQuote(BigDecimal baseRatePerUnit, BigDecimal effectiveRatePerUnit,
                               BigDecimal discountPercent, BigDecimal renewableSharePercent,
                               BigDecimal renewableDiscountPercent, BigDecimal gridIncentivePercent,
                               BigDecimal utilizationAdjustmentPercent, BigDecimal congestionAdjustmentPercent,
                               String gridSignalType, LocalDateTime validAt) {}

    public DynamicQuote quote(Station station, BigDecimal baseRate, LocalDateTime start, LocalDateTime end) {
        if (baseRate == null) return new DynamicQuote(null, null, BigDecimal.ZERO, null,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, start);
        LocalDateTime from = start == null ? LocalDateTime.now() : start;
        LocalDateTime to = end == null || !end.isAfter(from) ? from.plusHours(1) : end;
        String region = ChargingImpactService.regionFor(station);
        try {
            int hours = (int) Math.min(48, Math.max(2, java.time.Duration.between(LocalDateTime.now(), to).toHours() + 2));
            List<GridPoint> forecast = energyService.forecast(region, hours);
            List<GridPoint> covered = forecast.stream()
                    .filter(point -> !point.getTimestamp().isBefore(from.withMinute(0)) && point.getTimestamp().isBefore(to))
                    .toList();
            if (covered.isEmpty() && !forecast.isEmpty()) covered = List.of(forecast.get(0));
            BigDecimal renewable = covered.stream().map(GridPoint::getRenewableSharePercent)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .divide(BigDecimal.valueOf(Math.max(1, covered.size())), 2, RoundingMode.HALF_UP);
            GridSignal incentive = gridSignalRepository.findTop20ByGridRegionOrderByCreatedAtDesc(region).stream()
                    .filter(signal -> !signal.isCancelled() && "SHIFT_TO_RENEWABLE".equals(signal.getSignalType()))
                    .filter(signal -> signal.getStartsAt() != null && signal.getEndsAt() != null)
                    .filter(signal -> signal.getStartsAt().isBefore(to) && signal.getEndsAt().isAfter(from))
                    .findFirst().orElse(null);
            double localKw = station == null || station.getRenewableAvailableForChargingKw() == null ? 0 : station.getRenewableAvailableForChargingKw();
            BigDecimal effectiveRenewable = renewable.add(BigDecimal.valueOf(Math.min(25, localKw / 2))).min(BigDecimal.valueOf(100));
            double renewablePart = Math.min(maxRenewableDiscount, effectiveRenewable.doubleValue() * renewableDiscountFactor);
            double gridPart = incentive == null ? 0 : Math.max(0, incentive.getIncentivePercent() == null
                    ? incentive.getRequestedReductionPercent() : incentive.getIncentivePercent());
            double utilizationPart = station != null && station.getStationUtilizationPercent() != null
                    && station.getStationUtilizationPercent() < lowUtilizationThreshold ? lowUtilizationIncentive : 0;
            double gridLoad = covered.stream().mapToDouble(p -> p.getGridLoadPercent().doubleValue()).average().orElse(0);
            double congestionPart = gridLoad >= congestionThreshold ? congestionAdjustment : 0;
            double cap = station != null && station.getMaximumDiscountPercent() != null
                    ? station.getMaximumDiscountPercent() : maxTotalDiscount;
            double total = Math.max(-20, Math.min(cap, Math.max(renewablePart, gridPart) + utilizationPart - congestionPart));
            BigDecimal discount = scale(total);
            double stationFloor = station != null && station.getMinimumRatePerKwh() != null
                    ? station.getMinimumRatePerKwh() : minimumRate;
            BigDecimal effective = baseRate.multiply(BigDecimal.ONE.subtract(discount.movePointLeft(2)))
                    .max(BigDecimal.valueOf(stationFloor)).setScale(2, RoundingMode.HALF_UP);
            return new DynamicQuote(baseRate, effective, discount, effectiveRenewable,
                    scale(renewablePart), scale(gridPart), scale(utilizationPart), scale(congestionPart),
                    incentive == null ? null : incentive.getSignalType(), from);
        } catch (RuntimeException ex) {
            log.warn("Dynamic tariff lookup failed for station {}; using published tariff", station == null ? null : station.getId());
            return new DynamicQuote(baseRate, baseRate.setScale(2, RoundingMode.HALF_UP),
                    BigDecimal.ZERO, null, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, from);
        }
    }

    public static BigDecimal discountPercent(BigDecimal renewableShare, Integer gridIncentivePercent) {
        double renewable = renewableShare == null ? 0 : renewableShare.doubleValue();
        // A continuous curve makes every measured change in renewable share
        // visible in the quote instead of keeping low-share windows at one flat rate.
        double renewableDiscount = Math.max(0, Math.min(30, renewable * 0.30));
        double gridIncentive = gridIncentivePercent == null ? 0 : Math.max(0, gridIncentivePercent);
        return BigDecimal.valueOf(Math.min(40, Math.max(renewableDiscount, gridIncentive)))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal scale(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }
}
