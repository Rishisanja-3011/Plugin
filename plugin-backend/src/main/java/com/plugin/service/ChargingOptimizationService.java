package com.plugin.service;

import com.plugin.dto.request.ChargingOptionsRequest;
import com.plugin.dto.response.EnergyResponses.ChargingOption;
import com.plugin.dto.response.EnergyResponses.ChargingOptions;
import com.plugin.dto.response.EnergyResponses.GridPoint;
import com.plugin.entity.GridSignal;
import com.plugin.enums.ChargingPreference;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.GridSignalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.ToDoubleFunction;

@Service
@RequiredArgsConstructor
public class ChargingOptimizationService {
    private static final double EFFICIENCY = 0.92;
    private final RenewableEnergyService energyService;
    private final GridSignalRepository gridSignalRepository;

    public ChargingOptions options(ChargingOptionsRequest request) {
        validate(request);
        double power = Math.min(request.getChargerPowerKw().doubleValue(), request.getStationAvailableCapacityKw().doubleValue());
        int slotsNeeded = (int) Math.ceil(request.getRequiredEnergyKwh().doubleValue() / (power * EFFICIENCY * 0.5));
        LocalDateTime earliest = ceilToHalfHour(request.getEarliestStartTime());
        LocalDateTime latestStart = request.getLatestEndTime().minusMinutes(slotsNeeded * 30L);
        if (latestStart.isBefore(earliest)) {
            throw new BadRequestException("The charging window is too short to deliver the requested energy");
        }

        long horizonHours = Math.max(2, Duration.between(LocalDateTime.now(), request.getLatestEndTime()).toHours() + 2);
        List<GridPoint> forecast = energyService.forecast(request.getGridRegion(), (int) Math.min(48, horizonHours));
        String gridRegion = forecast.get(0).getGridRegion();
        List<GridSignal> gridSignals = gridSignalRepository.findTop20ByGridRegionOrderByCreatedAtDesc(gridRegion);
        List<Candidate> candidates = new ArrayList<>();
        for (LocalDateTime start = earliest; !start.isAfter(latestStart); start = start.plusMinutes(30)) {
            LocalDateTime candidateStart = start;
            LocalDateTime end = candidateStart.plusMinutes(slotsNeeded * 30L);
            GridSignal signal = applicableSignal(gridSignals, candidateStart, end);
            int reduction = signal != null && "REDUCE_LOAD".equals(signal.getSignalType())
                    ? Math.max(0, Math.min(100, signal.getRequestedReductionPercent() == null ? 0 : signal.getRequestedReductionPercent()))
                    : 0;
            double signalledCapacity = request.getStationAvailableCapacityKw().doubleValue() * (1 - reduction / 100.0);
            if (power > signalledCapacity) continue;
            List<GridPoint> covered = forecast.stream()
                    .filter(p -> !p.getTimestamp().isBefore(candidateStart.withMinute(0)) && p.getTimestamp().isBefore(end))
                    .toList();
            if (!covered.isEmpty()) candidates.add(candidate(candidateStart, end, power, request, covered, signal, reduction));
        }
        if (candidates.isEmpty()) {
            throw new BadRequestException("No charging window satisfies the forecast and active grid-capacity signals");
        }
        Candidate immediate = candidates.get(0);
        Map<String, Candidate> selected = new LinkedHashMap<>();
        selected.put("GREENEST", candidates.stream().max(Comparator.comparingDouble(Candidate::renewable)).orElseThrow());
        selected.put("CHEAPEST", candidates.stream().min(Comparator.comparingDouble(Candidate::price)).orElseThrow());
        selected.put("FASTEST", immediate);
        selected.put("BALANCED", candidates.stream().max(Comparator.comparingDouble(Candidate::balancedScore)).orElseThrow());

        List<ChargingOption> options = selected.entrySet().stream()
                .map(e -> response(e.getKey(), e.getValue(), immediate, request.getRequiredEnergyKwh(), power))
                .sorted(preferenceOrder(request.getPreference()))
                .toList();
        GridPoint first = forecast.get(0);
        return ChargingOptions.builder()
                .stationId(request.getStationId())
                .gridRegion(gridRegion)
                .requestedPreference(request.getPreference().name())
                .options(options)
                .dataMode(first.getDataMode())
                .disclaimer(disclaimer(first))
                .generatedAt(LocalDateTime.now())
                .build();
    }

    private static String disclaimer(GridPoint point) {
        return switch (point.getDataMode()) {
            case "LIVE" -> "Live grid data supplied by " + point.getSource() + ". Actual electricity delivered remains grid-mixed.";
            case "STALE" -> "The provider is temporarily unavailable. Showing the last cached grid outlook; verify before acting.";
            case "FORECAST" -> "Forecast derived from recent India grid fuel-mix data. Actual renewable share and price may vary.";
            default -> "SIMULATED planning estimate; not a live utility measurement.";
        };
    }

    private static void validate(ChargingOptionsRequest request) {
        if (!request.getLatestEndTime().isAfter(request.getEarliestStartTime())) {
            throw new BadRequestException("Latest end time must be after earliest start time");
        }
        if (Duration.between(request.getEarliestStartTime(), request.getLatestEndTime()).toHours() > 48) {
            throw new BadRequestException("Charging window cannot exceed 48 hours");
        }
        if (request.getLatestEndTime().isBefore(LocalDateTime.now().minusMinutes(1))) {
            throw new BadRequestException("Charging window cannot be in the past");
        }
    }

    private static Candidate candidate(LocalDateTime start, LocalDateTime end, double power,
                                       ChargingOptionsRequest request, List<GridPoint> covered,
                                       GridSignal signal, int reduction) {
        double renewable = avg(covered, p -> p.getRenewableSharePercent().doubleValue());
        double gridLoad = avg(covered, p -> p.getGridLoadPercent().doubleValue());
        double price = request.getStationTariff() != null ? request.getStationTariff().doubleValue()
                : avg(covered, p -> p.getElectricityPricePerKwh().doubleValue());
        double carbon = avg(covered, p -> p.getCarbonIntensityGco2PerKwh().doubleValue());
        double balanced = renewable * 0.45 + (100 - normalize(price, 8, 24)) * 0.25
                + (100 - gridLoad) * 0.20 + Math.max(0, 100 - Duration.between(request.getEarliestStartTime(), start).toMinutes() / 15.0) * 0.10
                - reduction * 0.5;
        return new Candidate(start, end, power, renewable, gridLoad, price, carbon, balanced, covered.get(0),
                signal == null ? null : signal.getSignalType(), reduction);
    }

    private static ChargingOption response(String type, Candidate c, Candidate immediate,
                                           BigDecimal energy, double power) {
        double kwh = energy.doubleValue();
        double cost = kwh * c.price() / EFFICIENCY;
        double carbonKg = kwh * c.carbon() / 1000.0;
        double immediateCarbonKg = kwh * immediate.carbon() / 1000.0;
        int greenScore = (int) Math.round(Math.max(0, Math.min(100,
                c.renewable() * .65 + (100 - c.gridLoad()) * .20 + (1 - c.carbon() / 800.0) * 15)));
        String explanation = "Start at " + c.start().toLocalTime() + " because renewable availability is forecast at "
                + Math.round(c.renewable()) + "%, grid load at " + Math.round(c.gridLoad())
                + "% and estimated tariff at ₹" + round(c.price()) + "/kWh.";
        if (c.gridSignalType() != null) {
            explanation += " Grid signal " + c.gridSignalType() + " applies"
                    + (c.requestedReductionPercent() > 0 ? " with a " + c.requestedReductionPercent() + "% load reduction request." : ".");
        }
        return ChargingOption.builder()
                .scheduleType(type).startTime(c.start()).endTime(c.end()).chargingPowerKw(round(power))
                .expectedRenewableSharePercent(round(c.renewable())).expectedGridLoadPercent(round(c.gridLoad()))
                .expectedPricePerKwh(round(c.price())).expectedTotalCost(round(cost))
                .expectedCarbonKg(round(carbonKg)).estimatedCarbonSavedKg(round(Math.max(0, immediateCarbonKg - carbonKg)))
                .greenScore(greenScore).explanation(explanation).dataMode(c.point().getDataMode()).source(c.point().getSource())
                .gridSignalType(c.gridSignalType()).requestedReductionPercent(c.requestedReductionPercent())
                .build();
    }

    private static GridSignal applicableSignal(List<GridSignal> signals, LocalDateTime start, LocalDateTime end) {
        return signals.stream()
                .filter(signal -> !signal.isCancelled())
                .filter(signal -> signal.getStartsAt() != null && signal.getEndsAt() != null)
                .filter(signal -> !"NORMAL_OPERATION".equals(signal.getSignalType()))
                .filter(signal -> signal.getStartsAt().isBefore(end) && signal.getEndsAt().isAfter(start))
                .max(Comparator.comparingInt(signal -> "REDUCE_LOAD".equals(signal.getSignalType())
                        ? (signal.getRequestedReductionPercent() == null ? 0 : signal.getRequestedReductionPercent()) : -1))
                .orElse(null);
    }

    private static Comparator<ChargingOption> preferenceOrder(ChargingPreference preference) {
        String requested = preference == null ? "BALANCED" : preference.name();
        return Comparator.comparingInt(o -> o.getScheduleType().equals(requested) ? 0 : 1);
    }

    private static double avg(List<GridPoint> points, ToDoubleFunction<GridPoint> fn) {
        return points.stream().mapToDouble(fn).average().orElse(0);
    }

    private static double normalize(double value, double min, double max) {
        return Math.max(0, Math.min(100, (value - min) * 100 / (max - min)));
    }

    private static BigDecimal round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private static LocalDateTime ceilToHalfHour(LocalDateTime value) {
        LocalDateTime clean = value.withSecond(0).withNano(0);
        int minute = clean.getMinute();
        if (minute == 0 || minute == 30) return clean;
        return minute < 30 ? clean.withMinute(30) : clean.plusHours(1).withMinute(0);
    }

    private record Candidate(LocalDateTime start, LocalDateTime end, double power, double renewable,
                             double gridLoad, double price, double carbon, double balancedScore, GridPoint point,
                             String gridSignalType, int requestedReductionPercent) {}
}
