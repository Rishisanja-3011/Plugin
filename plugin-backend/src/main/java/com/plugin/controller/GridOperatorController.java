package com.plugin.controller;

import com.plugin.dto.response.EnergyResponses.DemandForecastPoint;
import com.plugin.dto.response.EnergyResponses.GridPoint;
import com.plugin.service.DemandForecastService;
import com.plugin.service.RenewableEnergyService;
import com.plugin.entity.GridSignal;
import com.plugin.repository.GridSignalRepository;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.StationRepository;
import com.plugin.entity.ChargingPoint;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.security.Principal;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/grid")
@RequiredArgsConstructor
public class GridOperatorController {
    private final RenewableEnergyService energyService;
    private final DemandForecastService demandForecastService;
    private final GridSignalRepository gridSignalRepository;
    private final StationRepository stationRepository;
    private final ChargingPointRepository chargingPointRepository;
    private final com.plugin.service.AuditService auditService;

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> dashboard(@RequestParam(defaultValue = "IN-WE") String region,
                                                         @RequestParam(required = false) Long stationId) {
        com.plugin.entity.Station station = stationId != null
                ? stationRepository.findByIdAndActiveTrue(stationId)
                    .orElseThrow(() -> new com.plugin.exception.ResourceNotFoundException("Station not found"))
                : stationRepository.findByActiveTrue().stream().findFirst()
                    .orElseThrow(() -> new com.plugin.exception.ResourceNotFoundException("No active station is available"));
        Long resolvedStationId = station.getId();
        BigDecimal stationCapacityKw = chargingPointRepository.findByStationId(resolvedStationId).stream()
                .map(this::ratedPower)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .max(BigDecimal.ONE);
        List<GridPoint> energy = energyService.forecast(com.plugin.service.ChargingImpactService.regionFor(station), 24);
        List<DemandForecastPoint> demand = demandForecastService.forecast(resolvedStationId, stationCapacityKw, 24);
        long overloadWindows = demand.stream().filter(DemandForecastPoint::isOverloadRisk).count();
        return ResponseEntity.ok(Map.of(
                "gridRegion", energy.get(0).getGridRegion(),
                "stationId", resolvedStationId,
                "stationCapacityKw", stationCapacityKw,
                "energyForecast", energy,
                "evDemandForecast", demand,
                "overloadWindowCount", overloadWindows,
                "dataMode", energy.get(0).getDataMode(),
                "methodology", "Explainable PLUGIN EV-demand forecast combined with the India grid renewable outlook"
        ));
    }

    @GetMapping("/signals")
    public ResponseEntity<List<GridSignal>> signals(@RequestParam(defaultValue = "IN-WE") String region) {
        return ResponseEntity.ok(gridSignalRepository.findTop20ByGridRegionOrderByCreatedAtDesc(region));
    }

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.web.bind.annotation.DeleteMapping("/signals/{id}")
    public ResponseEntity<GridSignal> cancel(@org.springframework.web.bind.annotation.PathVariable Long id, Principal principal) {
        GridSignal signal = gridSignalRepository.findById(id)
                .orElseThrow(() -> new com.plugin.exception.ResourceNotFoundException("Grid signal not found"));
        signal.setCancelled(true);
        GridSignal saved = gridSignalRepository.save(signal);
        auditService.log("CANCEL_GRID_SIGNAL", "GRID_REGION", id, principal.getName(), signal.getGridRegion());
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/signals")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<GridSignal> publishSignal(@RequestBody GridSignalRequest request, Principal principal) {
        if (request.gridRegion() == null || !List.of("IN-NR", "IN-WE", "IN-SR", "IN-ER", "IN-NER").contains(request.gridRegion())) {
            throw new com.plugin.exception.BadRequestException("Select a valid India grid region");
        }
        String type = request.signalType() == null ? "" : request.signalType().trim().toUpperCase();
        if (!List.of("REDUCE_LOAD", "SHIFT_TO_RENEWABLE", "NORMAL_OPERATION").contains(type)) {
            throw new com.plugin.exception.BadRequestException("Unsupported grid signal type");
        }
        if (request.startsAt() == null || request.endsAt() == null || !request.endsAt().isAfter(request.startsAt())) {
            throw new com.plugin.exception.BadRequestException("A valid grid-signal time window is required");
        }
        if (!request.endsAt().isAfter(LocalDateTime.now()) || java.time.Duration.between(request.startsAt(), request.endsAt()).compareTo(java.time.Duration.ofHours(48)) > 0) {
            throw new com.plugin.exception.BadRequestException("Signal must end in the future and last at most 48 hours");
        }
        if (request.requestedReductionPercent() != null && (request.requestedReductionPercent() < 0 || request.requestedReductionPercent() > 100)) {
            throw new com.plugin.exception.BadRequestException("Reduction must be between 0 and 100 percent");
        }
        if (request.message() != null && request.message().length() > 1000) {
            throw new com.plugin.exception.BadRequestException("Message must be at most 1000 characters");
        }
        int reduction = Math.max(0, Math.min(100, request.requestedReductionPercent() == null ? 0 : request.requestedReductionPercent()));
        GridSignal saved = gridSignalRepository.save(GridSignal.builder()
                .gridRegion(request.gridRegion() == null ? "IN-WE" : request.gridRegion().trim().toUpperCase())
                .signalType(type).requestedReductionPercent(reduction)
                .startsAt(request.startsAt()).endsAt(request.endsAt()).message(request.message())
                .actorEmail(principal.getName()).build());
        auditService.log("PUBLISH_GRID_SIGNAL", "GRID_REGION", saved.getId(), principal.getName(), type);
        return ResponseEntity.ok(saved);
    }

    public record GridSignalRequest(String gridRegion, String signalType, Integer requestedReductionPercent,
                                    LocalDateTime startsAt, LocalDateTime endsAt, String message) {}

    private BigDecimal ratedPower(ChargingPoint point) {
        return BigDecimal.valueOf(Math.max(0, point.getMaxPowerKw() == null ? 0 : point.getMaxPowerKw()));
    }
}
