package com.plugin.repository;

import com.plugin.entity.Booking;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public interface BookingRepositoryCustom {
    record CustomerBookingCounts(long total, long completed, long cancelled, long active) {}

    boolean existsActiveByCustomerId(Long customerId, LocalDateTime now);

    List<Booking> findOverlappingBookings(Long pointId, LocalDateTime startTime, LocalDateTime endTime);

    List<Booking> findOverlappingBookingsExcluding(Long pointId,
                                                   LocalDateTime startTime,
                                                   LocalDateTime endTime,
                                                   Long excludeId);

    List<Booking> findBookingsForPointOnDay(Long pointId, LocalDateTime dayStart, LocalDateTime dayEnd);

    Page<Booking> findByStationId(Long stationId, Pageable pageable);

    long countDistinctCustomersByStationManagerId(Long managerId);

    long countDistinctCustomersByStationIds(List<Long> stationIds);

    Map<Long, CustomerBookingCounts> countBookingsByCustomerIds(List<Long> customerIds);

    long countBookingsInRange(LocalDateTime start, LocalDateTime end);

    List<Object[]> findBusiestHours();

    List<Object[]> findBusiestHoursByManagerId(Long managerId);

    List<Object[]> findBusiestHoursByStationIds(List<Long> stationIds);
}
