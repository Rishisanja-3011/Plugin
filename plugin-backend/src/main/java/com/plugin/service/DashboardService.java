package com.plugin.service;

import com.plugin.dto.response.DashboardStats;
import com.plugin.entity.User;
import com.plugin.enums.*;
import com.plugin.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final StationRepository stationRepository;
    private final ChargingPointRepository cpRepository;
    private final BookingRepository bookingRepository;
    private final ChargingSessionRepository sessionRepository;
    private final BillRepository billRepository;
    private final UserRepository userRepository;

    public DashboardStats getStats(String actorEmail) {
        User actor = userRepository.findByEmail(actorEmail)
                .orElseThrow(() -> new com.plugin.exception.ResourceNotFoundException("User not found"));

        boolean isAdmin = actor.getRole() == Role.ADMIN;
        long totalStations = isAdmin ? stationRepository.count() : stationRepository.countByManagerId(actor.getId());
        long activeStations = isAdmin ? stationRepository.countByActiveTrue() : stationRepository.countByManagerIdAndActiveTrue(actor.getId());
        long totalPoints = isAdmin ? cpRepository.count() : cpRepository.countByStationManagerId(actor.getId());
        long availablePoints = isAdmin ? cpRepository.countByStatus(PointStatus.AVAILABLE) : cpRepository.countByStationManagerIdAndStatus(actor.getId(), PointStatus.AVAILABLE);
        long totalBookings = isAdmin ? bookingRepository.count() : bookingRepository.countByStationManagerId(actor.getId());
        long activeBookings = isAdmin
                ? bookingRepository.countByStatus(BookingStatus.CONFIRMED) + bookingRepository.countByStatus(BookingStatus.MODIFIED)
                : bookingRepository.countByStationManagerIdAndStatus(actor.getId(), BookingStatus.CONFIRMED)
                + bookingRepository.countByStationManagerIdAndStatus(actor.getId(), BookingStatus.MODIFIED);
        long totalSessions = isAdmin ? sessionRepository.count() : sessionRepository.countByChargingPointStationManagerId(actor.getId());
        long activeSessions = isAdmin ? sessionRepository.countByStatus(SessionStatus.IN_PROGRESS) : sessionRepository.countByChargingPointStationManagerIdAndStatus(actor.getId(), SessionStatus.IN_PROGRESS);
        BigDecimal totalRevenue = isAdmin ? billRepository.getTotalRevenue() : billRepository.getTotalRevenueByManagerId(actor.getId());
        BigDecimal totalEnergy = isAdmin ? sessionRepository.getTotalEnergyDelivered() : sessionRepository.getTotalEnergyDeliveredByManagerId(actor.getId());
        long totalCustomers = isAdmin ? userRepository.countByRole(Role.CUSTOMER) : bookingRepository.countDistinctCustomersByStationManagerId(actor.getId());

        List<Object[]> busiestHoursRaw = isAdmin ? bookingRepository.findBusiestHours() : bookingRepository.findBusiestHoursByManagerId(actor.getId());
        List<Map<String, Object>> busiestHours = new ArrayList<>();
        for (Object[] row : busiestHoursRaw) {
            Map<String, Object> map = new HashMap<>();
            map.put("hour", row[0]);
            map.put("count", row[1]);
            busiestHours.add(map);
        }

        return DashboardStats.builder()
                .totalStations(totalStations)
                .activeStations(activeStations)
                .totalChargingPoints(totalPoints)
                .availablePoints(availablePoints)
                .totalBookings(totalBookings)
                .activeBookings(activeBookings)
                .totalSessions(totalSessions)
                .activeSessions(activeSessions)
                .totalRevenue(totalRevenue)
                .totalEnergyKwh(totalEnergy)
                .totalCustomers(totalCustomers)
                .busiestHours(busiestHours)
                .build();
    }
}
