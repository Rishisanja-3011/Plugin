package com.plugin.service;

import com.plugin.dto.response.DashboardStats;
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

    public DashboardStats getStats() {
        long totalStations = stationRepository.count();
        long activeStations = stationRepository.countByActiveTrue();
        long totalPoints = cpRepository.count();
        long availablePoints = cpRepository.countByStatus(PointStatus.AVAILABLE);
        long totalBookings = bookingRepository.count();
        long activeBookings = bookingRepository.countByStatus(BookingStatus.CONFIRMED)
                + bookingRepository.countByStatus(BookingStatus.MODIFIED);
        long totalSessions = sessionRepository.count();
        long activeSessions = sessionRepository.countByStatus(SessionStatus.IN_PROGRESS);
        BigDecimal totalRevenue = billRepository.getTotalRevenue();
        BigDecimal totalEnergy = sessionRepository.getTotalEnergyDelivered();
        long totalCustomers = userRepository.countByRole(Role.CUSTOMER);

        List<Object[]> busiestHoursRaw = bookingRepository.findBusiestHours();
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
