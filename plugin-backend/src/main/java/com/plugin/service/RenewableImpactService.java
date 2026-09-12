package com.plugin.service;

import com.plugin.dto.response.RenewableImpactResponse;
import com.plugin.entity.Booking;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Service @RequiredArgsConstructor
public class RenewableImpactService {
    private final BookingRepository bookings;
    private final UserRepository users;

    public RenewableImpactResponse global() { return aggregate(bookings.findAll()); }

    public RenewableImpactResponse customer(String email) {
        var user = users.findByEmail(email).orElseThrow(() -> new com.plugin.exception.ResourceNotFoundException("User not found"));
        return aggregate(bookings.findAll().stream().filter(b -> user.getId().equals(b.getCustomerId())
                || b.getCustomer() != null && user.getId().equals(b.getCustomer().getId())).toList());
    }

    private RenewableImpactResponse aggregate(List<Booking> source) {
        List<Booking> measured = source.stream().filter(b -> b.getRequestedEnergyKwh() != null
                && b.getExpectedRenewableSharePercent() != null).toList();
        long accepted = measured.stream().filter(b -> b.getChargingPreference() != null).count();
        double energy = measured.stream().mapToDouble(b -> b.getRequestedEnergyKwh().doubleValue()).sum();
        double renewable = measured.stream().mapToDouble(b -> b.getRequestedEnergyKwh().doubleValue()
                * b.getExpectedRenewableSharePercent().doubleValue() / 100).sum();
        double shifted = measured.stream().mapToDouble(b -> b.getRequestedEnergyKwh().doubleValue()
                * Math.max(0, n(b.getExpectedRenewableSharePercent()) - n(b.getBaselineRenewableSharePercent())) / 100).sum();
        double carbon = measured.stream().mapToDouble(b -> n(b.getEstimatedCarbonSavedKg())).sum();
        double money = measured.stream().mapToDouble(b -> Math.max(0,
                n(b.getBaseRatePerUnit()) - n(b.getLockedRatePerUnit())) * b.getRequestedEnergyKwh().doubleValue() / .92).sum();
        double avgShare = measured.stream().mapToDouble(b -> b.getExpectedRenewableSharePercent().doubleValue()).average().orElse(0);
        return RenewableImpactResponse.builder().bookingsEvaluated(measured.size())
                .greenRecommendationsAccepted(accepted)
                .acceptanceRatePercent(decimal(measured.isEmpty() ? 0 : accepted * 100.0 / measured.size()))
                .chargingEnergyKwh(decimal(energy)).renewableEnergyUtilizedKwh(decimal(renewable))
                .demandShiftedKwh(decimal(shifted)).estimatedPeakDemandAvoidedKwh(decimal(shifted * .60))
                .estimatedMoneySaved(decimal(money)).estimatedCarbonAvoidedKg(decimal(carbon))
                .averageRenewableSharePercent(decimal(avgShare))
                .methodology("Calculated from immutable renewable and carbon snapshots locked on bookings; peak avoidance is a labelled 60% planning estimate until meter telemetry is connected.")
                .generatedAt(LocalDateTime.now()).build();
    }
    private static double n(BigDecimal value) { return value == null ? 0 : value.doubleValue(); }
    private static BigDecimal decimal(double value) { return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP); }
}
