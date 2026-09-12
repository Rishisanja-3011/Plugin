package com.plugin.service;

import com.plugin.enums.Role;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Duration;

@Service @RequiredArgsConstructor @Slf4j
public class RenewableAlertService {
    private final RenewableEnergyService energy;
    private final UserRepository users;
    private final NotificationService notifications;
    @Value("${app.energy.alerts.region:IN-WE}") private String region;
    @Value("${app.energy.alerts.minimum-share-percent:40}") private double minimumShare;

    @Scheduled(initialDelayString = "${app.energy.alerts.initial-delay-ms:180000}",
            fixedDelayString = "${app.energy.alerts.check-delay-ms:1800000}")
    public void notifyCustomersOfMeaningfulSurplus() {
        try {
            var best = energy.forecast(region, 12).stream()
                    .filter(p -> p.getRenewableSharePercent().doubleValue() >= minimumShare)
                    .max(java.util.Comparator.comparing(p -> p.getRenewableSharePercent())).orElse(null);
            if (best == null) return;
            String message = "Renewable availability is expected to reach " + best.getRenewableSharePercent().setScale(0,
                    java.math.RoundingMode.HALF_UP) + "% at " + best.getTimestamp().toLocalTime()
                    + ". Open Smart Schedule to compare the greener price and carbon saving. " + best.getDataMode() + " · " + best.getSource();
            users.findByRole(Role.CUSTOMER).stream().filter(u -> Boolean.TRUE.equals(u.getActive())).forEach(user ->
                    notifications.sendIfNew(user.getId(), "High-renewable charging window", message, Duration.ofHours(6)));
        } catch (RuntimeException ex) {
            log.warn("Renewable customer alert skipped because provider data is unavailable");
        }
    }
}
