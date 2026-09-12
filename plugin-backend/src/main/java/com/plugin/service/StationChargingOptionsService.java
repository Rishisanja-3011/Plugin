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
        var tariff = pricing.findByStationIdAndPointType(station.getId(), connector.getPointType())
                .orElseThrow(() -> new BadRequestException("Station operator must configure the connector tariff before comparing costs"));
        request.setStationTariff(tariff.getRatePerUnit());
        var result = optimizer.options(request);
        result.setDisclaimer(result.getDisclaimer() + " Costs use the station's published tariff. Grid model prices do not change billing. Availability and operating hours are checked again at booking.");
        return result;
    }
}
