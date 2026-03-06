package com.plugin.service;

import com.plugin.dto.request.BookingRequest;
import com.plugin.dto.response.BookingResponse;
import com.plugin.entity.*;
import com.plugin.enums.*;
import com.plugin.exception.*;
import com.plugin.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final StationRepository stationRepository;
    private final ChargingPointRepository cpRepository;
    private final UserRepository userRepository;
    private final PricingSnapshotService pricingSnapshotService;
    private final AuditService auditService;
    private final NotificationService notificationService;

    @Transactional
    public BookingResponse createBooking(BookingRequest request, String customerEmail) {
        User customer = userRepository.findByEmail(customerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        Station station = stationRepository.findById(request.getStationId())
                .orElseThrow(() -> new ResourceNotFoundException("Station not found"));

        if (!station.getActive()) {
            throw new BadRequestException("Station is currently inactive");
        }

        LocalDateTime startTime = request.getStartTime();
        LocalDateTime endTime = startTime.plusMinutes(request.getDurationMinutes());

        // Validate within operating hours
        validateOperatingHours(station, startTime, endTime);

        // Validate start time is in the future
        if (startTime.isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Booking start time must be in the future");
        }

        ChargingPoint chargingPoint;

        if (request.getChargingPointId() != null) {
            // Specific point requested
            chargingPoint = cpRepository.findById(request.getChargingPointId())
                    .orElseThrow(() -> new ResourceNotFoundException("Charging point not found"));

            if (!chargingPoint.getStation().getId().equals(station.getId())) {
                throw new BadRequestException("Charging point does not belong to this station");
            }

            if (chargingPoint.getStatus() == PointStatus.OUT_OF_SERVICE) {
                throw new BadRequestException("Charging point is out of service");
            }

            // Check overlap
            List<Booking> overlapping = bookingRepository.findOverlappingBookings(
                    chargingPoint.getId(), startTime, endTime);
            if (!overlapping.isEmpty()) {
                throw new ConflictException("Time slot is already booked for this charging point");
            }
        } else {
            // Auto-assign: find an available charging point
            chargingPoint = autoAssignPoint(station.getId(), request.getPointTypePreference(), startTime, endTime);
        }

        String refId = generateReferenceId();
        PricingSnapshotService.PricingSnapshot lockedPricing =
                pricingSnapshotService.resolveFor(station, chargingPoint.getPointType());

        Booking booking = Booking.builder()
                .referenceId(refId)
                .customer(customer)
                .station(station)
                .chargingPoint(chargingPoint)
                .startTime(startTime)
                .endTime(endTime)
                .lockedRatePerUnit(lockedPricing.ratePerUnit())
                .lockedRateType(lockedPricing.rateType())
                .status(BookingStatus.CONFIRMED)
                .build();

        booking = bookingRepository.save(booking);

        if (lockedPricing.usedFallback()) {
            pricingSnapshotService.notifyAdminsMissingPricing(
                    station,
                    chargingPoint.getPointType(),
                    "Booking " + refId + " was created by " + customerEmail + "."
            );
        }

        auditService.log("CREATE_BOOKING", "BOOKING", booking.getId(), customerEmail,
                "Booking created: " + refId);

        notificationService.send(customer.getId(), "Booking Confirmed",
                "Your booking " + refId + " at " + station.getName() +
                " is confirmed for " + startTime.format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm")));

        return toResponse(booking);
    }

    @Transactional
    public BookingResponse modifyBooking(Long bookingId, BookingRequest request, String customerEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getCustomer().getEmail().equals(customerEmail)) {
            throw new BadRequestException("You can only modify your own bookings");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Cannot modify a " + booking.getStatus() + " booking");
        }

        if (booking.getStartTime().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Cannot modify a booking that has already started");
        }

        LocalDateTime startTime = request.getStartTime();
        LocalDateTime endTime = startTime.plusMinutes(request.getDurationMinutes());

        Station station = booking.getStation();
        validateOperatingHours(station, startTime, endTime);

        if (startTime.isBefore(LocalDateTime.now())) {
            throw new BadRequestException("New start time must be in the future");
        }

        Long pointId = request.getChargingPointId() != null ?
                request.getChargingPointId() : booking.getChargingPoint().getId();

        List<Booking> overlapping = bookingRepository.findOverlappingBookingsExcluding(
                pointId, startTime, endTime, booking.getId());
        if (!overlapping.isEmpty()) {
            throw new ConflictException("New time slot conflicts with existing bookings");
        }

        if (request.getChargingPointId() != null) {
            ChargingPoint cp = cpRepository.findById(request.getChargingPointId())
                    .orElseThrow(() -> new ResourceNotFoundException("Charging point not found"));
            booking.setChargingPoint(cp);
        }

        booking.setStartTime(startTime);
        booking.setEndTime(endTime);
        PricingSnapshotService.PricingSnapshot lockedPricing =
                pricingSnapshotService.resolveFor(booking.getStation(), booking.getChargingPoint().getPointType());
        booking.setLockedRatePerUnit(lockedPricing.ratePerUnit());
        booking.setLockedRateType(lockedPricing.rateType());
        booking.setStatus(BookingStatus.MODIFIED);
        booking = bookingRepository.save(booking);

        if (lockedPricing.usedFallback()) {
            pricingSnapshotService.notifyAdminsMissingPricing(
                    booking.getStation(),
                    booking.getChargingPoint().getPointType(),
                    "Booking " + booking.getReferenceId() + " was modified by " + customerEmail + "."
            );
        }

        auditService.log("MODIFY_BOOKING", "BOOKING", booking.getId(), customerEmail,
                "Booking modified: " + booking.getReferenceId());

        notificationService.send(booking.getCustomer().getId(), "Booking Modified",
                "Your booking " + booking.getReferenceId() + " has been modified.");

        return toResponse(booking);
    }

    @Transactional
    public BookingResponse cancelBooking(Long bookingId, String customerEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getCustomer().getEmail().equals(customerEmail)) {
            throw new BadRequestException("You can only cancel your own bookings");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new BadRequestException("Booking is already cancelled");
        }

        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Cannot cancel a completed booking");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking = bookingRepository.save(booking);

        auditService.log("CANCEL_BOOKING", "BOOKING", booking.getId(), customerEmail,
                "Booking cancelled: " + booking.getReferenceId());

        notificationService.send(booking.getCustomer().getId(), "Booking Cancelled",
                "Your booking " + booking.getReferenceId() + " has been cancelled.");

        return toResponse(booking);
    }

    @Transactional
    public BookingResponse cancelBookingAsAdmin(Long bookingId, String adminEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new BadRequestException("Booking is already cancelled");
        }

        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Cannot cancel a completed booking");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking = bookingRepository.save(booking);

        try {
            auditService.log("CANCEL_BOOKING", "BOOKING", booking.getId(), adminEmail,
                    "Booking cancelled by admin: " + booking.getReferenceId());
        } catch (Exception ex) {
            log.warn("Failed to write audit log for admin booking cancel {}", booking.getId(), ex);
        }

        try {
            notificationService.send(booking.getCustomer().getId(), "Booking Cancelled",
                    "Your booking " + booking.getReferenceId() + " has been cancelled by admin.");
        } catch (Exception ex) {
            log.warn("Failed to send cancel notification for booking {}", booking.getId(), ex);
        }

        return toResponse(booking);
    }

    public Page<BookingResponse> getMyBookings(String email, Pageable pageable) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return bookingRepository.findByCustomerIdOrderByCreatedAtDesc(customer.getId(), pageable)
                .map(this::toResponse);
    }

    public BookingResponse getBookingById(Long id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        return toResponse(booking);
    }

    public Page<BookingResponse> getAllBookings(Pageable pageable, BookingStatus status) {
        if (status == null) {
            return bookingRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::toResponse);
        }
        return bookingRepository.findByStatusOrderByCreatedAtDesc(status, pageable).map(this::toResponse);
    }

    public Page<BookingResponse> getBookingsByStation(Long stationId, Pageable pageable) {
        return bookingRepository.findByStationId(stationId, pageable).map(this::toResponse);
    }

    public Map<String, Long> getBookingStats() {
        long total = bookingRepository.count();
        long completed = bookingRepository.countByStatus(BookingStatus.COMPLETED);
        long cancelled = bookingRepository.countByStatus(BookingStatus.CANCELLED);
        return Map.of(
                "total", total,
                "completed", completed,
                "cancelled", cancelled
        );
    }

    /**
     * Get available time slots for a charging point on a given date.
     */
    public List<String> getAvailableSlots(Long stationId, Long pointId, LocalDate date) {
        Station station = stationRepository.findById(stationId)
                .orElseThrow(() -> new ResourceNotFoundException("Station not found"));

        LocalDateTime dayStart = date.atTime(station.getOpeningTime());
        LocalDateTime dayEnd = date.atTime(station.getClosingTime());

        if (station.getClosingTime().isBefore(station.getOpeningTime())) {
            dayEnd = date.plusDays(1).atTime(station.getClosingTime());
        }

        List<Booking> existingBookings = bookingRepository.findBookingsForPointOnDay(
                pointId, date.atStartOfDay(), date.plusDays(1).atStartOfDay());

        List<String> slots = new ArrayList<>();
        LocalDateTime cursor = dayStart;
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH:mm");

        while (cursor.plusMinutes(30).compareTo(dayEnd) <= 0) {
            LocalDateTime slotEnd = cursor.plusMinutes(30);
            final LocalDateTime slotStart = cursor;
            boolean isAvailable = existingBookings.stream().noneMatch(b ->
                    slotStart.isBefore(b.getEndTime()) && slotEnd.isAfter(b.getStartTime()));
            if (isAvailable) {
                slots.add(cursor.format(fmt) + " - " + slotEnd.format(fmt));
            }
            cursor = cursor.plusMinutes(30);
        }

        return slots;
    }

    private ChargingPoint autoAssignPoint(Long stationId, String typePreference,
                                           LocalDateTime startTime, LocalDateTime endTime) {
        List<ChargingPoint> candidates;
        if (typePreference != null && !typePreference.isEmpty()) {
            PointType pt = PointType.valueOf(typePreference);
            candidates = cpRepository.findByStationIdAndPointType(stationId, pt);
        } else {
            candidates = cpRepository.findByStationId(stationId);
        }

        for (ChargingPoint cp : candidates) {
            if (cp.getStatus() == PointStatus.OUT_OF_SERVICE) continue;
            List<Booking> overlapping = bookingRepository.findOverlappingBookings(cp.getId(), startTime, endTime);
            if (overlapping.isEmpty()) {
                return cp;
            }
        }
        throw new ConflictException("No available charging points for the requested time slot");
    }

    private void validateOperatingHours(Station station, LocalDateTime start, LocalDateTime end) {
        LocalTime startOfDay = start.toLocalTime();
        LocalTime endOfDay = end.toLocalTime();

        LocalTime open = station.getOpeningTime();
        LocalTime close = station.getClosingTime();

        if (close.isAfter(open)) {
            // Normal hours (e.g., 06:00 - 23:00)
            if (startOfDay.isBefore(open) || endOfDay.isAfter(close)) {
                throw new BadRequestException("Booking must be within station operating hours: " +
                        open + " - " + close);
            }
        }
        // For 24hr or overnight stations, we allow any time
    }

    private String generateReferenceId() {
        return "BK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private BookingResponse toResponse(Booking b) {
        return BookingResponse.builder()
                .id(b.getId())
                .referenceId(b.getReferenceId())
                .customerId(b.getCustomer().getId())
                .customerName(b.getCustomer().getFullName())
                .stationId(b.getStation().getId())
                .stationName(b.getStation().getName())
                .chargingPointId(b.getChargingPoint().getId())
                .chargingPointIdentifier(b.getChargingPoint().getIdentifier())
                .pointType(b.getChargingPoint().getPointType().name())
                .startTime(b.getStartTime())
                .endTime(b.getEndTime())
                .lockedRatePerUnit(b.getLockedRatePerUnit())
                .lockedRateType(b.getLockedRateType())
                .status(b.getStatus().name())
                .createdAt(b.getCreatedAt())
                .updatedAt(b.getUpdatedAt())
                .build();
    }
}
