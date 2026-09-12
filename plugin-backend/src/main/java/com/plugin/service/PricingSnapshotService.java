package com.plugin.service;

import com.plugin.entity.Pricing;
import com.plugin.entity.Station;
import com.plugin.entity.User;
import com.plugin.enums.PointType;
import com.plugin.enums.PricingModel;
import com.plugin.enums.Role;
import com.plugin.repository.PricingRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PricingSnapshotService {

    public record PricingSnapshot(BigDecimal ratePerUnit, BigDecimal baseRatePerUnit,
                                  BigDecimal discountPercent, String rateType, boolean usedFallback) {}

    private final PricingRepository pricingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final DynamicPricingService dynamicPricingService;

    @Value("${app.billing.default-rate-per-kwh:15}")
    private BigDecimal defaultRatePerKwh;

    public PricingSnapshot resolveFor(Station station, PointType pointType) {
        return resolveFor(station, pointType, java.time.LocalDateTime.now(), java.time.LocalDateTime.now().plusHours(1));
    }

    public PricingSnapshot resolveFor(Station station, PointType pointType,
                                      java.time.LocalDateTime start, java.time.LocalDateTime end) {
        Pricing pricing = pricingRepository.findByStationIdAndPointType(station.getId(), pointType).orElse(null);
        if (pricing != null) {
            var quote = dynamicPricingService.quote(station, pricing.getRatePerUnit(), start, end);
            return new PricingSnapshot(quote.effectiveRatePerUnit(), quote.baseRatePerUnit(),
                    quote.discountPercent(), PricingModel.PER_KWH.name(), false);
        }
        var quote = dynamicPricingService.quote(station, defaultRatePerKwh, start, end);
        return new PricingSnapshot(quote.effectiveRatePerUnit(), quote.baseRatePerUnit(),
                quote.discountPercent(), PricingModel.PER_KWH.name(), true);
    }

    public void notifyAdminsMissingPricing(Station station, PointType pointType, String context) {
        List<User> admins = userRepository.findByRole(Role.ADMIN);
        if (admins.isEmpty()) return;

        String title = "Missing Pricing Rule";
        String message = "Using default rate for station " + station.getName() +
                " (" + pointType.name() + "). " + context;

        admins.forEach(admin -> notificationService.send(admin.getId(), title, message));
    }
}
