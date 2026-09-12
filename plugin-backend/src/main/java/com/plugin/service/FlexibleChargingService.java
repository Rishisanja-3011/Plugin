package com.plugin.service;

import com.plugin.dto.request.ChargingOptionsRequest;
import com.plugin.dto.request.FlexibleChargingRequest;
import com.plugin.dto.response.EnergyResponses.ChargingOption;
import com.plugin.dto.response.FlexibleChargingPlanResponse;
import com.plugin.entity.ChargingPoint;
import com.plugin.entity.Station;
import com.plugin.enums.PointStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@Service @RequiredArgsConstructor
public class FlexibleChargingService {
    private final StationRepository stations;
    private final ChargingPointRepository points;
    private final StationChargingOptionsService optionsService;

    public FlexibleChargingPlanResponse plan(FlexibleChargingRequest request) {
        if (!request.getReadyBy().isAfter(request.getEarliestStartTime())) throw new BadRequestException("Ready-by time must be after arrival time");
        List<Plan> plans = new ArrayList<>(); List<String> evaluated = new ArrayList<>();
        for (Station station : stations.findByActiveTrue()) {
            Double distance = distance(request.getLatitude(), request.getLongitude(), station.getLatitude(), station.getLongitude());
            if (distance != null && request.getMaximumTravelDistanceKm() != null
                    && distance > request.getMaximumTravelDistanceKm().doubleValue()) continue;
            List<ChargingPoint> available = points.findByStationId(station.getId()).stream()
                    .filter(p -> p.getStatus() == PointStatus.AVAILABLE && p.getMaxPowerKw() != null && p.getMaxPowerKw() > 0).toList();
            if (available.isEmpty()) continue; evaluated.add(station.getName());
            ChargingPoint connector = available.stream().max(Comparator.comparing(ChargingPoint::getMaxPowerKw)).orElseThrow();
            ChargingOptionsRequest options = new ChargingOptionsRequest();
            options.setStationId(station.getId()); options.setChargingPointId(connector.getId());
            options.setRequiredEnergyKwh(request.getRequiredEnergyKwh()); options.setEarliestStartTime(request.getEarliestStartTime());
            options.setLatestEndTime(request.getReadyBy()); options.setChargerPowerKw(BigDecimal.valueOf(connector.getMaxPowerKw()));
            options.setStationAvailableCapacityKw(BigDecimal.valueOf(connector.getMaxPowerKw())); options.setPreference(request.getPreference());
            options.setMaximumPricePerKwh(request.getMaximumPricePerKwh()); options.setMinimumRenewableSharePercent(request.getMinimumRenewableSharePercent());
            try {
                ChargingOption selected = optionsService.options(options).getOptions().stream()
                        .filter(o -> o.getScheduleType().equals(request.getPreference().name())).findFirst().orElseThrow();
                double score = selected.getGreenScore() - (distance == null ? 0 : distance * 2) - selected.getExpectedPricePerKwh().doubleValue() * .2;
                plans.add(new Plan(station, connector, distance, selected, score));
            } catch (RuntimeException ignored) { /* station is infeasible; continue evaluating */ }
        }
        Plan best = plans.stream().max(Comparator.comparingDouble(Plan::score)).orElseThrow(() -> new BadRequestException("No station and time satisfy all flexible-charging constraints"));
        return FlexibleChargingPlanResponse.builder().stationId(best.station().getId()).stationName(best.station().getName())
                .chargingPointId(best.point().getId()).connectorType(best.point().getConnectorType())
                .distanceKm(best.distance() == null ? null : BigDecimal.valueOf(best.distance()).setScale(2, RoundingMode.HALF_UP))
                .selectedOption(best.option()).evaluatedStations(evaluated)
                .explanation("Automatically selected the strongest feasible station and " + request.getPreference().name().toLowerCase()
                        + " time within the ready-by, renewable, price and travel constraints. Confirm to create the existing price-locked booking.")
                .generatedAt(LocalDateTime.now()).build();
    }
    private static Double distance(Double a, Double b, Double c, Double d) {
        if (a == null || b == null || c == null || d == null) return null;
        double x=Math.toRadians(c-a), y=Math.toRadians(d-b), q=Math.sin(x/2)*Math.sin(x/2)+Math.cos(Math.toRadians(a))*Math.cos(Math.toRadians(c))*Math.sin(y/2)*Math.sin(y/2);
        return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
    }
    private record Plan(Station station, ChargingPoint point, Double distance, ChargingOption option, double score) {}
}
