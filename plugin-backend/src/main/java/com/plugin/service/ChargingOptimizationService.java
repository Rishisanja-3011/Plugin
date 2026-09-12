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
            GridSignal capacitySignal = applicableSignal(gridSignals, candidateStart, end, "REDUCE_LOAD");
            GridSignal priceSignal = applicableSignal(gridSignals, candidateStart, end, "SHIFT_TO_RENEWABLE");
            int reduction = capacitySignal != null
                    ? Math.max(0, Math.min(100, capacitySignal.getRequestedReductionPercent() == null ? 0 : capacitySignal.getRequestedReductionPercent()))
                    : 0;
            if (request.getMaximumWaitMinutes() != null
                    && Duration.between(request.getEarliestStartTime(), candidateStart).toMinutes() > request.getMaximumWaitMinutes()) continue;
            double signalledCapacity = request.getStationAvailableCapacityKw().doubleValue() * (1 - reduction / 100.0);
            if (power > signalledCapacity) continue;
            List<GridPoint> covered = forecast.stream()
                    .filter(p -> !p.getTimestamp().isBefore(candidateStart.withMinute(0)) && p.getTimestamp().isBefore(end))
                    .toList();
            if (!covered.isEmpty()) {
                Candidate candidate = candidate(candidateStart, end, power, request, covered,
                        capacitySignal != null ? capacitySignal : priceSignal, reduction,
                        priceSignal == null ? null : priceSignal.getRequestedReductionPercent());
                if (request.getMinimumRenewableSharePercent() != null
                        && candidate.renewable() < request.getMinimumRenewableSharePercent().doubleValue()) continue;
                if (request.getMaximumPricePerKwh() != null
                        && candidate.price() > request.getMaximumPricePerKwh().doubleValue()) continue;
                candidates.add(candidate);
            }
        }
        if (candidates.isEmpty()) {
            throw new BadRequestException("No charging window satisfies the forecast and active grid-capacity signals");
        }
        Candidate immediate = candidates.get(0);
        Map<String, Candidate> selected = selectBestStrategies(candidates, request.getPreference());

        List<ChargingOption> options = selected.entrySet().stream()
                .map(e -> response(e.getKey(), e.getValue(), immediate, request.getRequiredEnergyKwh(), power))
                .sorted(preferenceOrder(request.getPreference()))
                .toList();
        GridPoint first = forecast.get(0);
        BigDecimal confidence = confidence(first, 0);
        return ChargingOptions.builder()
                .stationId(request.getStationId())
                .gridRegion(gridRegion)
                .requestedPreference(request.getPreference().name())
                .options(options)
                .dataMode(first.getDataMode())
                .disclaimer(disclaimer(first))
                .generatedAt(LocalDateTime.now())
                .bestOptionType(request.getPreference() == null ? "BALANCED" : request.getPreference().name())
                .constraintSummary(constraintSummary(request))
                .confidencePercent(confidence).source(first.getSource()).quality(first.getQuality())
                .sourceTimestamp(sourceTimestamp(first))
                .cached("STALE".equalsIgnoreCase(first.getDataMode()))
                .simulated(isSimulated(first)).fallbackReason(fallbackReason(first))
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
        if (request.getBatterySocPercent() != null && request.getTargetSocPercent() != null
                && request.getTargetSocPercent().compareTo(request.getBatterySocPercent()) <= 0) {
            throw new BadRequestException("Target battery level must be above the current battery level");
        }
    }

    private static Candidate candidate(LocalDateTime start, LocalDateTime end, double power,
                                       ChargingOptionsRequest request, List<GridPoint> covered,
                                       GridSignal signal, int reduction, Integer gridIncentivePercent) {
        double gridRenewable = avg(covered, p -> p.getRenewableSharePercent().doubleValue());
        double localRenewablePower = number(request.getStationLocalRenewableKw()) + number(request.getStationBatteryDischargeKw());
        double localShare = Math.min(100, localRenewablePower / Math.max(1, power) * 100);
        double renewable = Math.min(100, gridRenewable + (100 - gridRenewable) * localShare / 100.0);
        double gridLoad = avg(covered, p -> p.getGridLoadPercent().doubleValue());
        double basePrice = request.getStationTariff() != null ? request.getStationTariff().doubleValue()
                : avg(covered, p -> p.getElectricityPricePerKwh().doubleValue());
        double renewableDiscount = Math.min(30, renewable * .30);
        double gridIncentive = gridIncentivePercent == null ? 0 : Math.max(0, gridIncentivePercent);
        double utilizationAdjustment = number(request.getStationUtilizationPercent()) < 35 ? 3 : 0;
        double discountCap = request.getMaximumDiscountPercent() == null ? 40 : request.getMaximumDiscountPercent().doubleValue();
        double discount = Math.min(discountCap, Math.max(renewableDiscount, gridIncentive) + utilizationAdjustment);
        double floor = request.getMinimumRatePerKwh() == null ? 1 : request.getMinimumRatePerKwh().doubleValue();
        double price = Math.max(floor, basePrice * (1 - discount / 100.0));
        double carbon = avg(covered, p -> p.getCarbonIntensityGco2PerKwh().doubleValue());
        double balanced = renewable * 0.45 + (100 - normalize(price, 8, 24)) * 0.25
                + (100 - gridLoad) * 0.20 + Math.max(0, 100 - Duration.between(request.getEarliestStartTime(), start).toMinutes() / 15.0) * 0.10
                - reduction * 0.5;
        return new Candidate(start, end, power, renewable, gridLoad, basePrice, discount, renewableDiscount,
                gridIncentive, utilizationAdjustment, price, carbon, balanced, covered.get(0),
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
        String explanation = objective(type) + " Start at " + c.start().toLocalTime() + " because renewable availability is forecast at "
                + Math.round(c.renewable()) + "%, grid load at " + Math.round(c.gridLoad())
                + "% and estimated tariff at ₹" + round(c.price()) + "/kWh.";
        if (c.gridSignalType() != null) {
            explanation += " Grid signal " + c.gridSignalType() + " applies"
                    + (c.requestedReductionPercent() > 0 ? " with a " + c.requestedReductionPercent() + "% load reduction request." : ".");
        }
        return ChargingOption.builder()
                .scheduleType(type).startTime(c.start()).endTime(c.end()).chargingPowerKw(round(power))
                .expectedRenewableSharePercent(round(c.renewable())).expectedGridLoadPercent(round(c.gridLoad()))
                .expectedPricePerKwh(round(c.price())).basePricePerKwh(round(c.basePrice()))
                .discountPercent(round(c.discount())).renewableDiscountPercent(round(c.renewableDiscount()))
                .gridIncentivePercent(round(c.gridIncentive())).utilizationAdjustmentPercent(round(c.utilizationAdjustment()))
                .expectedTotalCost(round(cost))
                .expectedCarbonKg(round(carbonKg)).estimatedCarbonSavedKg(round(Math.max(0, immediateCarbonKg - carbonKg)))
                .baselineRenewableSharePercent(round(immediate.renewable())).baselinePricePerKwh(round(immediate.price()))
                .baselineTotalCost(round(kwh * immediate.price() / EFFICIENCY))
                .estimatedMoneySaved(round(Math.max(0, kwh * (immediate.price() - c.price()) / EFFICIENCY)))
                .renewableEnergyShiftedKwh(round(kwh * Math.max(0, c.renewable() - immediate.renewable()) / 100.0))
                .greenScore(greenScore).explanation(explanation).objective(objective(type))
                .dataMode(c.point().getDataMode()).source(c.point().getSource()).quality(c.point().getQuality())
                .confidencePercent(confidence(c.point(), Math.max(0, (int) Duration.between(LocalDateTime.now(), c.start()).toHours())))
                .sourceTimestamp(sourceTimestamp(c.point()))
                .forecastHorizonMinutes(Math.max(0, (int) Duration.between(
                        c.point().getSourceTimestamp() == null ? c.point().getTimestamp() : c.point().getSourceTimestamp(), c.start()).toMinutes()))
                .cached("STALE".equalsIgnoreCase(c.point().getDataMode()))
                .simulated(isSimulated(c.point())).fallbackReason(fallbackReason(c.point()))
                .gridSignalType(c.gridSignalType()).requestedReductionPercent(c.requestedReductionPercent())
                .build();
    }

    private static GridSignal applicableSignal(List<GridSignal> signals, LocalDateTime start, LocalDateTime end,
                                               String signalType) {
        return signals.stream()
                .filter(signal -> !signal.isCancelled())
                .filter(signal -> signal.getStatus() == null || "ACTIVE".equals(signal.getStatus()))
                .filter(signal -> signal.getStartsAt() != null && signal.getEndsAt() != null)
                .filter(signal -> signalType.equals(signal.getSignalType()))
                .filter(signal -> signal.getStartsAt().isBefore(end) && signal.getEndsAt().isAfter(start))
                .max(Comparator.comparingInt(signal ->
                        signal.getRequestedReductionPercent() == null ? 0 : signal.getRequestedReductionPercent()))
                .orElse(null);
    }

    private static Comparator<ChargingOption> preferenceOrder(ChargingPreference preference) {
        String requested = preference == null ? "BALANCED" : preference.name();
        return Comparator.comparingInt(o -> o.getScheduleType().equals(requested) ? 0 : 1);
    }

    private static Map<String, Candidate> selectBestStrategies(List<Candidate> candidates,
                                                                    ChargingPreference preference) {
        String requested = preference == null ? "BALANCED" : preference.name();
        List<String> strategies = new ArrayList<>(List.of(requested));
        List.of("GREENEST", "CHEAPEST", "FASTEST", "BALANCED").stream()
                .filter(strategy -> !strategy.equals(requested))
                .forEach(strategies::add);

        Map<String, Candidate> selected = new LinkedHashMap<>();
        for (String strategy : strategies) {
            Comparator<Candidate> comparator = strategyComparator(strategy);
            Candidate choice = candidates.stream().sorted(comparator).findFirst().orElseThrow();
            selected.put(strategy, choice);
        }
        return selected;
    }

    private static Comparator<Candidate> strategyComparator(String strategy) {
        return switch (strategy) {
            case "GREENEST" -> Comparator.comparingDouble(Candidate::renewable).reversed()
                    .thenComparingDouble(Candidate::carbon).thenComparing(Candidate::start);
            case "CHEAPEST" -> Comparator.comparingDouble(Candidate::price)
                    .thenComparing(Comparator.comparingDouble(Candidate::renewable).reversed())
                    .thenComparing(Candidate::start);
            case "FASTEST" -> Comparator.comparing(Candidate::start);
            default -> Comparator.comparingDouble(Candidate::balancedScore).reversed()
                    .thenComparing(Candidate::start);
        };
    }

    private static String objective(String type) {
        return switch (type) {
            case "GREENEST" -> "Maximizes renewable share, then minimizes carbon intensity.";
            case "CHEAPEST" -> "Minimizes the final adjusted charging price.";
            case "FASTEST" -> "Selects the earliest feasible charging window.";
            default -> "Balances renewable share (45%), price (25%), grid safety (20%) and waiting time (10%).";
        };
    }

    private static LocalDateTime sourceTimestamp(GridPoint point) {
        return point.getSourceTimestamp() == null ? point.getTimestamp() : point.getSourceTimestamp();
    }

    private static boolean isSimulated(GridPoint point) {
        return "DEMO".equalsIgnoreCase(point.getDataMode()) || "SIMULATED".equalsIgnoreCase(point.getDataMode())
                || point.getQuality() != null && point.getQuality().toUpperCase().contains("SIMULATED");
    }

    private static String fallbackReason(GridPoint point) {
        if ("STALE".equalsIgnoreCase(point.getDataMode())) return "Provider refresh failed; last cached provider result is shown.";
        if (isSimulated(point)) return "Configured demo provider; values are planning estimates, not grid measurements.";
        if ("FORECAST".equalsIgnoreCase(point.getDataMode())) return "Future values are derived from the latest provider observation and documented forecast profile.";
        return null;
    }

    private static BigDecimal confidence(GridPoint point, int horizonHours) {
        double base = switch (String.valueOf(point.getDataMode()).toUpperCase()) {
            case "LIVE" -> 95;
            case "FORECAST" -> 84;
            case "STALE" -> 55;
            default -> 45;
        };
        return round(Math.max(20, base - Math.min(30, horizonHours * 1.25)));
    }

    private static String constraintSummary(ChargingOptionsRequest r) {
        List<String> constraints = new ArrayList<>();
        constraints.add(r.getRequiredEnergyKwh() + " kWh ready by " + r.getLatestEndTime());
        if (r.getMinimumRenewableSharePercent() != null) constraints.add("at least " + r.getMinimumRenewableSharePercent() + "% renewable");
        if (r.getMaximumPricePerKwh() != null) constraints.add("maximum ₹" + r.getMaximumPricePerKwh() + "/kWh");
        if (r.getMaximumWaitMinutes() != null) constraints.add("maximum wait " + r.getMaximumWaitMinutes() + " minutes");
        return String.join("; ", constraints);
    }

    private static double number(BigDecimal value) {
        return value == null ? 0 : value.doubleValue();
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
                             double gridLoad, double basePrice, double discount, double renewableDiscount,
                             double gridIncentive, double utilizationAdjustment, double price,
                             double carbon, double balancedScore, GridPoint point,
                             String gridSignalType, int requestedReductionPercent) {}
}
