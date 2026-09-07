package com.plugin.service;

import com.plugin.config.AppClock;
import com.plugin.entity.Booking;
import com.plugin.entity.ChargingPoint;
import com.plugin.entity.Station;
import com.plugin.enums.PointStatus;
import com.plugin.enums.PointType;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ConflictException;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.ChargingPointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EtaSlotAllocator {
    public static final int GRACE_MINUTES = 20;
    public static final int MAX_HOLD_MINUTES = 120;
    private final BookingRepository bookings;
    private final ChargingPointRepository points;

    public Slot allocate(Station station, PointType type, LocalDateTime arrival,
                         int duration, LocalDateTime latestStart, Long excludedBooking) {
        if (!Boolean.TRUE.equals(station.getActive())) throw new BadRequestException("Station is currently inactive");
        List<ChargingPoint> candidates = points.findByStationIdAndPointType(station.getId(), type).stream()
                .filter(p -> p.getStatus() != PointStatus.OUT_OF_SERVICE && p.getStatus() != PointStatus.UNAVAILABLE)
                .sorted(Comparator.comparing(ChargingPoint::getId)).toList();
        Slot best = null;
        for (ChargingPoint point : candidates) {
            LocalDateTime start = arrival;
            // Calendar reservations include the entire late-arrival allowance.
            for (int attempt = 0; attempt < 200 && !start.isAfter(latestStart); attempt++) {
                LocalDateTime end = start.plusMinutes(duration);
                LocalDateTime until = end.plusMinutes(GRACE_MINUTES);
                try {
                    StationOperatingHoursPolicy.validate(station, start, until);
                } catch (BadRequestException outsideHours) {
                    break;
                }
                List<Booking> overlaps = excludedBooking == null
                        ? bookings.findOverlappingBookings(point.getId(), stored(start), stored(until))
                        : bookings.findOverlappingBookingsExcluding(point.getId(), stored(start), stored(until), excludedBooking);
                if (overlaps.isEmpty()) {
                    // A busy connector with no calendar owner has unknown availability.
                    if (point.getStatus() != PointStatus.AVAILABLE && start.equals(arrival)) break;
                    Slot slot = new Slot(point, start, end, until);
                    if (best == null || slot.start().isBefore(best.start())) best = slot;
                    break;
                }
                LocalDateTime next = overlaps.stream().map(EtaSlotAllocator::reservationEnd)
                        .filter(java.util.Objects::nonNull).max(LocalDateTime::compareTo)
                        .map(AppClock::fromStoredScheduleTime).orElse(start);
                if (!next.isAfter(start)) break;
                start = next;
            }
        }
        if (best == null) throw new ConflictException("No charging window is available within the ETA hold limit and station hours. Choose another station or a scheduled booking.");
        points.touchSchedule(best.point().getId());
        return best;
    }

    public static LocalDateTime reservationEnd(Booking booking) {
        return booking.getReservedUntil() != null ? booking.getReservedUntil() : booking.getEndTime();
    }

    private static LocalDateTime stored(LocalDateTime time) { return AppClock.toStoredScheduleTime(time); }
    public record Slot(ChargingPoint point, LocalDateTime start, LocalDateTime end, LocalDateTime reservedUntil) { }
}
