package com.plugin.service;

import com.plugin.entity.ChargingPoint;
import com.plugin.entity.Pricing;
import com.plugin.entity.Station;
import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.PricingRepository;
import com.plugin.repository.StationRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class StationOperatorAccessService {

    private final UserRepository userRepository;
    private final StationRepository stationRepository;
    private final ChargingPointRepository chargingPointRepository;
    private final PricingRepository pricingRepository;
    private final EntityReferenceResolver referenceResolver;

    public User getActor(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public boolean isAdmin(User actor) {
        return actor.getRole() == Role.ADMIN;
    }

    public void requireAdmin(String email) {
        User actor = getActor(email);
        if (!isAdmin(actor)) {
            throw new AccessDeniedException("Only admins can perform this action");
        }
    }

    public Station getAccessibleStation(Long stationId, String actorEmail) {
        User actor = getActor(actorEmail);
        if (isAdmin(actor)) {
            return stationRepository.findById(stationId)
                    .orElseThrow(() -> new ResourceNotFoundException("Station not found"));
        }
        return stationRepository.findByIdAndManagerId(stationId, actor.getId())
                .orElseThrow(() -> new AccessDeniedException("You can only manage your own station"));
    }

    public ChargingPoint getAccessibleChargingPoint(Long chargingPointId, String actorEmail) {
        ChargingPoint chargingPoint = chargingPointRepository.findById(chargingPointId)
                .orElseThrow(() -> new ResourceNotFoundException("Charging point not found"));
        chargingPoint = referenceResolver.hydrate(chargingPoint);
        Long stationId = chargingPoint.getStation() != null ? chargingPoint.getStation().getId() : chargingPoint.getStationId();
        getAccessibleStation(stationId, actorEmail);
        return chargingPoint;
    }

    public Pricing getAccessiblePricing(Long pricingId, String actorEmail) {
        Pricing pricing = pricingRepository.findById(pricingId)
                .orElseThrow(() -> new ResourceNotFoundException("Pricing not found"));
        pricing = referenceResolver.hydrate(pricing);
        Long stationId = pricing.getStation() != null ? pricing.getStation().getId() : pricing.getStationId();
        getAccessibleStation(stationId, actorEmail);
        return pricing;
    }
}
