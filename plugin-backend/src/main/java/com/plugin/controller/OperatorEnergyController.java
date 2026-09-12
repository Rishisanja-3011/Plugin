package com.plugin.controller;

import com.plugin.dto.response.EnergyResponses.GridPoint;
import com.plugin.dto.response.EnergyResponses.OperatorDashboard;
import com.plugin.dto.response.EnergyResponses.DemandForecastPoint;
import com.plugin.dto.response.EnergyResponses.GridSignalSummary;
import com.plugin.service.DemandForecastService;
import com.plugin.service.RenewableEnergyService;
import com.plugin.service.StationOperatorAccessService;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.StationRepository;
import com.plugin.repository.EnergyRecommendationDecisionRepository;
import com.plugin.repository.GridSignalRepository;
import com.plugin.entity.EnergyRecommendationDecision;
import com.plugin.entity.ChargingPoint;
import com.plugin.entity.Station;
import com.plugin.entity.GridSignal;
import com.plugin.entity.User;
import com.plugin.enums.PointStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.security.Principal;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/operator/energy")
@RequiredArgsConstructor
public class OperatorEnergyController {
    private final RenewableEnergyService energyService;
    private final DemandForecastService demandForecastService;
    private final StationOperatorAccessService accessService;
    private final StationRepository stationRepository;
    private final ChargingPointRepository chargingPointRepository;
    private final EnergyRecommendationDecisionRepository decisionRepository;
    private final GridSignalRepository gridSignalRepository;
    private final com.plugin.service.AuditService auditService;

    @GetMapping("/dashboard")
    public ResponseEntity<OperatorDashboard> dashboard(@RequestParam(required = false) String region,
                                                        @RequestParam(required = false) Long stationId,
                                                        Principal principal) {
        Station station = resolveStation(stationId, principal.getName());
        List<ChargingPoint> points = chargingPointRepository.findByStationId(station.getId());
        BigDecimal stationCapacityKw = power(points).max(BigDecimal.ONE);
        BigDecimal physicalAvailable = power(points.stream()
                .filter(point -> point.getStatus() == PointStatus.AVAILABLE)
                .toList());
        List<GridPoint> forecast = energyService.forecast(region, 24);
        GridPoint current = forecast.get(0);
        GridPoint surplus = forecast.stream().max(Comparator.comparing(GridPoint::getRenewableSharePercent)).orElse(current);
        GridPoint peak = forecast.stream().max(Comparator.comparing(GridPoint::getGridLoadPercent)).orElse(current);
        List<DemandForecastPoint> demand = demandForecastService.forecast(station.getId(), stationCapacityKw, 24);
        BigDecimal chargingLoad = power(points.stream()
                .filter(point -> point.getStatus() == PointStatus.CHARGING)
                .toList());
        LocalDateTime now = LocalDateTime.now();
        GridSignal applicableSignal = gridSignalRepository.findTop20ByGridRegionOrderByCreatedAtDesc(current.getGridRegion())
                .stream()
                .filter(signal -> !signal.isCancelled() && signal.getEndsAt() != null && signal.getEndsAt().isAfter(now))
                .filter(signal -> signal.getStartsAt() == null || signal.getStartsAt().isBefore(now.plusHours(24)))
                .min(Comparator.comparing(signal -> signal.getStartsAt() == null ? now : signal.getStartsAt()))
                .orElse(null);
        return ResponseEntity.ok(OperatorDashboard.builder()
                .gridRegion(current.getGridRegion()).current(current)
                .nextRenewableSurplusStart(surplus.getTimestamp()).nextRenewableSurplusPercent(surplus.getRenewableSharePercent())
                .nextPeakRiskStart(peak.getTimestamp()).predictedPeakLoadPercent(peak.getGridLoadPercent())
                .configuredStationCapacityKw(stationCapacityKw).availableCapacityKw(physicalAvailable)
                .currentChargingLoadKw(chargingLoad)
                .renewableUtilizationPercent(current.getRenewableSharePercent())
                .recommendation("Offer a green discount near " + surplus.getTimestamp().toLocalTime() + " and protect capacity near " + peak.getTimestamp().toLocalTime() + ".")
                .activeGridSignal(toSummary(applicableSignal))
                .dataMode(current.getDataMode()).forecast(forecast).demandForecast(demand).build());
    }

    @GetMapping("/decisions")
    public ResponseEntity<List<EnergyRecommendationDecision>> decisions(@RequestParam Long stationId,
                                                                         Principal principal) {
        accessService.getAccessibleStation(stationId, principal.getName());
        return ResponseEntity.ok(decisionRepository.findTop20ByStationIdOrderByCreatedAtDesc(stationId));
    }

    @PostMapping("/decisions")
    public ResponseEntity<EnergyRecommendationDecision> decide(@RequestBody DecisionRequest request,
                                                                Principal principal) {
        Station station = accessService.getAccessibleStation(request.stationId(), principal.getName());
        String action = request.action() == null ? "" : request.action().trim().toUpperCase();
        if (!List.of("ACCEPTED", "DEFERRED", "REJECTED").contains(action)) {
            throw new com.plugin.exception.BadRequestException("Action must be ACCEPTED, DEFERRED or REJECTED");
        }
        EnergyRecommendationDecision saved = decisionRepository.save(EnergyRecommendationDecision.builder()
                .stationId(station.getId()).gridRegion(request.gridRegion()).action(action)
                .recommendation(request.recommendation()).reason(request.reason())
                .actorEmail(principal.getName()).build());
        auditService.log("ENERGY_RECOMMENDATION_" + action, "STATION", station.getId(), principal.getName(),
                request.recommendation());
        return ResponseEntity.ok(saved);
    }

    public record DecisionRequest(Long stationId, String gridRegion, String action,
                                  String recommendation, String reason) {}

    private Station resolveStation(Long stationId, String actorEmail) {
        if (stationId != null) return accessService.getAccessibleStation(stationId, actorEmail);
        User actor = accessService.getActor(actorEmail);
        List<Station> stations = accessService.isAdmin(actor)
                ? stationRepository.findByActiveTrue()
                : stationRepository.findByManagerId(actor.getId());
        return stations.stream().findFirst()
                .orElseThrow(() -> new com.plugin.exception.ResourceNotFoundException("No managed station is available"));
    }

    private static BigDecimal power(List<ChargingPoint> points) {
        return points.stream().map(point -> BigDecimal.valueOf(Math.max(0, point.getMaxPowerKw() == null ? 0 : point.getMaxPowerKw())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static GridSignalSummary toSummary(GridSignal signal) {
        if (signal == null) return null;
        return GridSignalSummary.builder()
                .signalType(signal.getSignalType())
                .requestedReductionPercent(signal.getRequestedReductionPercent())
                .startsAt(signal.getStartsAt())
                .endsAt(signal.getEndsAt())
                .message(signal.getMessage())
                .build();
    }
}
