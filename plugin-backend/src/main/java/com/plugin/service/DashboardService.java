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
        List<Long> managedStationIds = isAdmin
                ? List.of()
                : stationRepository.findByManagerId(actor.getId()).stream()
                        .map(com.plugin.entity.Station::getId)
                        .toList();
        List<Long> managedPointIds = isAdmin
                ? List.of()
                : cpRepository.findByStationIdIn(managedStationIds).stream()
                        .map(com.plugin.entity.ChargingPoint::getId)
                        .toList();

        long totalStations = isAdmin ? stationRepository.count() : stationRepository.countByManagerId(actor.getId());
        long activeStations = isAdmin ? stationRepository.countByActiveTrue() : stationRepository.countByManagerIdAndActiveTrue(actor.getId());
        long totalPoints = isAdmin ? cpRepository.count() : cpRepository.countByStationIdIn(managedStationIds);
        long availablePoints = isAdmin ? cpRepository.countByStatus(PointStatus.AVAILABLE) : cpRepository.countByStationIdInAndStatus(managedStationIds, PointStatus.AVAILABLE);
        long totalBookings = isAdmin ? bookingRepository.count() : bookingRepository.countByStationIdIn(managedStationIds);
        long activeBookings = isAdmin
                ? bookingRepository.countByStatus(BookingStatus.CONFIRMED) + bookingRepository.countByStatus(BookingStatus.MODIFIED)
                : bookingRepository.countByStationIdInAndStatus(managedStationIds, BookingStatus.CONFIRMED)
                + bookingRepository.countByStationIdInAndStatus(managedStationIds, BookingStatus.MODIFIED);
        long totalSessions = isAdmin ? sessionRepository.count() : sessionRepository.countByChargingPointIdIn(managedPointIds);
        long activeSessions = isAdmin ? sessionRepository.countByStatus(SessionStatus.IN_PROGRESS) : sessionRepository.countByChargingPointIdInAndStatus(managedPointIds, SessionStatus.IN_PROGRESS);
        BigDecimal totalRevenue = isAdmin ? billRepository.getTotalRevenue() : billRepository.getTotalRevenueByStationIds(managedStationIds);
        BigDecimal totalEnergy = isAdmin ? sessionRepository.getTotalEnergyDelivered() : sessionRepository.getTotalEnergyDeliveredByChargingPointIds(managedPointIds);
        long totalCustomers = isAdmin ? userRepository.countByRole(Role.CUSTOMER) : bookingRepository.countDistinctCustomersByStationIds(managedStationIds);

        List<Object[]> busiestHoursRaw = isAdmin ? bookingRepository.findBusiestHours() : bookingRepository.findBusiestHoursByStationIds(managedStationIds);
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
