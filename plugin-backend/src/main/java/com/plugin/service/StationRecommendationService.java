package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.GridPoint;
import com.plugin.dto.response.EnergyResponses.StationRecommendation;
import com.plugin.entity.Station;
import com.plugin.entity.User;
import com.plugin.enums.PointStatus;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.StationRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StationRecommendationService {
    private final StationRepository stations;
    private final ChargingPointRepository points;
    private final UserRepository users;
    private final RenewableEnergyService energy;
    private final NotificationService notifications;

    public List<StationRecommendation> recommend(String customerEmail) {
        return recommend(customerEmail, null, null);
    }

    public List<StationRecommendation> recommend(String customerEmail, Double latitude, Double longitude) {
        User customer = users.findByEmailIgnoreCase(customerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Map<String, GridPoint> outlookByRegion = new HashMap<>();
        java.util.concurrent.atomic.AtomicBoolean providerUnavailable = new java.util.concurrent.atomic.AtomicBoolean();
        List<StationRecommendation> ranked = stations.findByActiveTrue().stream().map(station -> {
            if (providerUnavailable.get()) return null;
            try {
                String region = ChargingImpactService.regionFor(station);
                GridPoint outlook = outlookByRegion.computeIfAbsent(region, energy::current);
                long available = points.findByStationId(station.getId()).stream()
                        .filter(point -> point.getStatus() == PointStatus.AVAILABLE).count();
                double localKw = station.getRenewableAvailableForChargingKw() == null ? 0 : station.getRenewableAvailableForChargingKw();
                double combinedRenewable = Math.min(100, outlook.getRenewableSharePercent().doubleValue() + Math.min(25, localKw / 2));
                Double distance = distanceKm(latitude, longitude, station.getLatitude(), station.getLongitude());
                int queueMinutes = available > 0 ? 0 : 20;
                int score = (int) Math.round(combinedRenewable * .55 + Math.min(20, available * 5)
                        + Math.max(0, 15 - (distance == null ? 5 : distance)) + (100 - number(station.getStationUtilizationPercent())) * .10);
                return toResponse(station, region, outlook, available, score, combinedRenewable, localKw, distance, queueMinutes);
            } catch (IllegalStateException unavailable) {
                providerUnavailable.set(true);
                return null;
            }
        }).filter(java.util.Objects::nonNull).filter(item -> item.getAvailablePoints() > 0)
                .sorted(Comparator.comparing(StationRecommendation::getRenewableSharePercent).reversed()
                        .thenComparing(StationRecommendation::getAvailablePoints, Comparator.reverseOrder())
                        .thenComparing(StationRecommendation::getStationId))
                .toList();
        if (!ranked.isEmpty()) {
            StationRecommendation best = ranked.get(0);
            notifications.sendIfNew(customer.getId(), "Greener charging window available",
                    best.getStationName() + " is currently the strongest PLUGIN option with "
                            + best.getRenewableSharePercent().setScale(0, java.math.RoundingMode.HALF_UP)
                            + "% regional renewable share and " + best.getAvailablePoints() + " available connector(s).",
                    Duration.ofHours(6));
        }
        if (!ranked.isEmpty()) ranked.get(0).setRecommendedGreenStation(true);
        return ranked;
    }

    private static StationRecommendation toResponse(Station station, String region, GridPoint outlook,
                                                      long available, int score, double combinedRenewable,
                                                      double localKw, Double distance, int queueMinutes) {
        return StationRecommendation.builder().stationId(station.getId()).stationName(station.getName())
                .city(station.getCity()).state(station.getState()).gridRegion(region).availablePoints(available)
                .renewableSharePercent(java.math.BigDecimal.valueOf(combinedRenewable).setScale(2, java.math.RoundingMode.HALF_UP))
                .regionalRenewableSharePercent(outlook.getRenewableSharePercent())
                .localRenewablePowerKw(java.math.BigDecimal.valueOf(localKw).setScale(2, java.math.RoundingMode.HALF_UP))
                .distanceKm(distance == null ? null : java.math.BigDecimal.valueOf(distance).setScale(2, java.math.RoundingMode.HALF_UP))
                .predictedQueueMinutes(queueMinutes).recommendationScore(Math.min(100, score))
                .reason("Recommended from " + Math.round(outlook.getRenewableSharePercent().doubleValue())
                        + "% regional renewables, " + Math.round(localKw) + " kW station-local renewable power, "
                        + available + " available connector(s)" + (distance == null ? "." : " and " + String.format("%.1f", distance) + " km route distance."))
                .dataMode(outlook.getDataMode()).sourceTimestamp(outlook.getSourceTimestamp()).build();
    }

    private static double number(Double value) { return value == null ? 50 : Math.max(0, Math.min(100, value)); }

    private static Double distanceKm(Double lat1, Double lon1, Double lat2, Double lon2) {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
        double dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
