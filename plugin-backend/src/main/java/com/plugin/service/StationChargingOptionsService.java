package com.plugin.service;

import com.plugin.dto.request.ChargingOptionsRequest;
import com.plugin.dto.response.EnergyResponses.ChargingOptions;
import com.plugin.entity.ChargingPoint;
import com.plugin.enums.PointStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.StationRepository;
import com.plugin.repository.PricingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class StationChargingOptionsService {
    private final StationRepository stations;
    private final ChargingPointRepository points;
    private final PricingRepository pricing;
    private final ChargingOptimizationService optimizer;

    public ChargingOptions options(ChargingOptionsRequest request) {
        var station = stations.findByIdAndActiveTrue(request.getStationId())
                .orElseThrow(() -> new ResourceNotFoundException("Active charging station not found"));
        var available = points.findByStationId(station.getId()).stream()
                .filter(p -> p.getStatus() == PointStatus.AVAILABLE && p.getMaxPowerKw() != null && p.getMaxPowerKw() > 0).toList();
        ChargingPoint connector = available.stream().filter(p -> request.getChargingPointId() != null
                ? request.getChargingPointId().equals(p.getId())
                : BigDecimal.valueOf(p.getMaxPowerKw()).compareTo(request.getChargerPowerKw()) == 0)
                .findFirst().orElseThrow(() -> new BadRequestException("Select an available connector at this station"));
        request.setGridRegion(ChargingImpactService.regionFor(station));
        request.setChargerPowerKw(BigDecimal.valueOf(connector.getMaxPowerKw()));
        request.setStationAvailableCapacityKw(available.stream().map(p -> BigDecimal.valueOf(p.getMaxPowerKw())).reduce(BigDecimal.ZERO, BigDecimal::add));
        if (station.getGridImportLimitKw() != null) {
            request.setStationAvailableCapacityKw(request.getStationAvailableCapacityKw().min(BigDecimal.valueOf(station.getGridImportLimitKw())
                    .add(value(station.getRenewableAvailableForChargingKw()))));
        }
        request.setStationLocalRenewableKw(value(station.getRenewableAvailableForChargingKw()));
        request.setStationBatteryDischargeKw(availableBatteryPower(station));
        request.setGridImportLimitKw(value(station.getGridImportLimitKw()));
        request.setStationUtilizationPercent(value(station.getStationUtilizationPercent()));
        request.setMinimumRatePerKwh(value(station.getMinimumRatePerKwh()));
        request.setMaximumDiscountPercent(value(station.getMaximumDiscountPercent()));
        request.setStationEnergyDataMode(station.getRenewableDataMode());
        var tariff = pricing.findByStationIdAndPointType(station.getId(), connector.getPointType())
                .orElseThrow(() -> new BadRequestException("Station operator must configure the connector tariff before comparing costs"));
        request.setStationTariff(tariff.getRatePerUnit());
        var result = optimizer.options(request);
        result.setDisclaimer(result.getDisclaimer() + " Prices start from the station's published tariff and apply the configured renewable, grid and utilization policy. More than one strategy may select the same window when it is genuinely optimal. The quote is refreshed and locked at booking; availability and operating hours are checked again.");
        return result;
    }

    private static BigDecimal value(Double number) {
        return number == null ? null : BigDecimal.valueOf(number);
    }

    private static BigDecimal availableBatteryPower(com.plugin.entity.Station station) {
        if (station.getBatteryCapacityKwh() == null || station.getBatteryStateOfChargePercent() == null) return null;
        double reserve = station.getEmergencyReservePercent() == null ? 20 : station.getEmergencyReservePercent();
        double usableKwh = station.getBatteryCapacityKwh()
                * Math.max(0, station.getBatteryStateOfChargePercent() - reserve) / 100.0;
        return BigDecimal.valueOf(Math.min(usableKwh * 2, station.getBatteryCapacityKwh()));
    }
}
