package com.plugin.service;

import com.plugin.dto.request.BookingRequest;
import com.plugin.dto.request.BookingRescheduleRequest;
import com.plugin.dto.response.BookingResponse;
import com.plugin.entity.*;
import com.plugin.enums.*;
import com.plugin.exception.*;
import com.plugin.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

@Service
@Slf4j
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final StationRepository stationRepository;
    private final ChargingPointRepository cpRepository;
    private final UserRepository userRepository;
    private final UserVehicleRepository userVehicleRepository;
    private final PricingSnapshotService pricingSnapshotService;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final EntityReferenceResolver referenceResolver;

    @Transactional
    public BookingResponse createBooking(BookingRequest request, String customerEmail) {
        User customer = userRepository.findByEmail(customerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
        UserVehicle activeVehicle = resolveActiveVehicle(customer);
        if (activeVehicle == null) {
            throw new BadRequestException("Please add a vehicle in your profile before booking a charging session");
        }

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
            chargingPoint = hydrate(chargingPoint);

            if (!chargingPoint.getStation().getId().equals(station.getId())) {
                throw new BadRequestException("Charging point does not belong to this station");
            }

            ensurePointAvailableForBooking(chargingPoint);

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
                .vehicle(activeVehicle)
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
        booking = hydrate(booking);

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

        ChargingPoint targetPoint = request.getChargingPointId() != null
                ? cpRepository.findById(request.getChargingPointId())
                    .orElseThrow(() -> new ResourceNotFoundException("Charging point not found"))
                : booking.getChargingPoint();
        targetPoint = hydrate(targetPoint);
        if (!targetPoint.getStation().getId().equals(station.getId())) {
            throw new BadRequestException("Charging point does not belong to this station");
        }
        ensurePointAvailableForBooking(targetPoint);

        List<Booking> overlapping = bookingRepository.findOverlappingBookingsExcluding(
                pointId, startTime, endTime, booking.getId());
        if (!overlapping.isEmpty()) {
            throw new ConflictException("New time slot conflicts with existing bookings");
        }

        if (request.getChargingPointId() != null) {
            booking.setChargingPoint(targetPoint);
        }

        booking.setStartTime(startTime);
        booking.setEndTime(endTime);
        PricingSnapshotService.PricingSnapshot lockedPricing =
                pricingSnapshotService.resolveFor(booking.getStation(), booking.getChargingPoint().getPointType());
        booking.setLockedRatePerUnit(lockedPricing.ratePerUnit());
        booking.setLockedRateType(lockedPricing.rateType());
        booking.setStatus(BookingStatus.MODIFIED);
        clearRescheduleRequestFields(booking);
        resetRescheduleReview(booking);
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
    public BookingResponse requestReschedule(Long bookingId, BookingRescheduleRequest request, String customerEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        booking = hydrate(booking);

        if (!booking.getCustomer().getEmail().equals(customerEmail)) {
            throw new BadRequestException("You can only request changes for your own bookings");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Cannot reschedule a " + booking.getStatus() + " booking");
        }

        if (!booking.getStartTime().isAfter(LocalDateTime.now())) {
            throw new BadRequestException("Cannot request reschedule for a booking that has already started");
        }

        if (booking.getRescheduleRequestStatus() == RescheduleRequestStatus.PENDING) {
            throw new BadRequestException("A reschedule request is already pending approval");
        }

        String normalizedReason = normalizeText(request.getReason());
        if (normalizedReason == null) {
            throw new BadRequestException("Reschedule reason is required");
        }

        int durationMinutes = getBookingDurationMinutes(booking);
        LocalDateTime requestedStartTime = request.getStartTime();
        if (requestedStartTime == null) {
            throw new BadRequestException("Requested start time is required");
        }
        LocalDateTime requestedEndTime = requestedStartTime.plusMinutes(durationMinutes);

        validateRescheduleSlot(booking, requestedStartTime, requestedEndTime);

        booking.setRescheduleRequestStatus(RescheduleRequestStatus.PENDING);
        booking.setRescheduleRequestedStartTime(requestedStartTime);
        booking.setRescheduleRequestedEndTime(requestedEndTime);
        booking.setRescheduleRequestReason(normalizedReason);
        booking.setRescheduleRequestedAt(LocalDateTime.now());
        resetRescheduleReview(booking);
        booking = bookingRepository.save(booking);

        auditService.log("REQUEST_BOOKING_RESCHEDULE", "BOOKING", booking.getId(), customerEmail,
                "Reschedule requested for " + booking.getReferenceId() + " to " + formatDateTimeValue(requestedStartTime));

        notifyAdmins(
                "Booking Reschedule Request",
                booking.getCustomer().getFullName() + " requested to move booking " + booking.getReferenceId() +
                        " to " + formatDateTimeValue(requestedStartTime) + "."
        );

        notificationService.send(booking.getCustomer().getId(), "Reschedule Request Sent",
                "Your reschedule request for booking " + booking.getReferenceId() + " is awaiting admin approval.");

        return toResponse(booking);
    }

    @Transactional
    public BookingResponse cancelBooking(Long bookingId, String customerEmail, String reason) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        booking = hydrate(booking);

        if (!booking.getCustomer().getEmail().equals(customerEmail)) {
            throw new BadRequestException("You can only cancel your own bookings");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new BadRequestException("Booking is already cancelled");
        }

        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Cannot cancel a completed booking");
        }

        String normalizedReason = normalizeText(reason);
        if (normalizedReason == null) {
            throw new BadRequestException("Cancellation reason is required");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(normalizedReason);
        clearRescheduleRequestFields(booking);
        resetRescheduleReview(booking);
        booking = bookingRepository.save(booking);

        auditService.log("CANCEL_BOOKING", "BOOKING", booking.getId(), customerEmail,
                "Booking cancelled: " + booking.getReferenceId() + ". Reason: " + normalizedReason);

        notificationService.send(booking.getCustomer().getId(), "Booking Cancelled",
                "Your booking " + booking.getReferenceId() + " has been cancelled. Reason: " + normalizedReason);

        return toResponse(booking);
    }

    @Transactional
    public BookingResponse cancelBookingAsAdmin(Long bookingId, String adminEmail, String reason) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        booking = hydrate(booking);

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new BadRequestException("Booking is already cancelled");
        }

        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Cannot cancel a completed booking");
        }

        String normalizedReason = normalizeText(reason);
        if (normalizedReason == null) {
            throw new BadRequestException("Cancellation reason is required");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(normalizedReason);
        clearRescheduleRequestFields(booking);
        resetRescheduleReview(booking);
        booking = bookingRepository.save(booking);

        try {
            auditService.log("CANCEL_BOOKING", "BOOKING", booking.getId(), adminEmail,
                    "Booking cancelled by admin: " + booking.getReferenceId() + ". Reason: " + normalizedReason);
        } catch (Exception ex) {
            log.warn("Failed to write audit log for admin booking cancel {}", booking.getId(), ex);
        }

        try {
            notificationService.send(booking.getCustomer().getId(), "Booking Cancelled",
                    "Your booking " + booking.getReferenceId() + " has been cancelled by admin. Reason: " + normalizedReason);
        } catch (Exception ex) {
            log.warn("Failed to send cancel notification for booking {}", booking.getId(), ex);
        }

        return toResponse(booking);
    }

    @Transactional
    public BookingResponse approveRescheduleRequest(Long bookingId, String adminEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        booking = hydrate(booking);

        if (booking.getRescheduleRequestStatus() != RescheduleRequestStatus.PENDING) {
            throw new BadRequestException("No pending reschedule request for this booking");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Cannot reschedule a " + booking.getStatus() + " booking");
        }

        LocalDateTime requestedStartTime = booking.getRescheduleRequestedStartTime();
        LocalDateTime requestedEndTime = booking.getRescheduleRequestedEndTime();
        if (requestedStartTime == null || requestedEndTime == null) {
            throw new BadRequestException("Requested reschedule slot is incomplete");
        }

        validateRescheduleSlot(booking, requestedStartTime, requestedEndTime);

        PricingSnapshotService.PricingSnapshot lockedPricing =
                pricingSnapshotService.resolveFor(booking.getStation(), booking.getChargingPoint().getPointType());

        booking.setStartTime(requestedStartTime);
        booking.setEndTime(requestedEndTime);
        booking.setLockedRatePerUnit(lockedPricing.ratePerUnit());
        booking.setLockedRateType(lockedPricing.rateType());
        booking.setStatus(BookingStatus.MODIFIED);
        booking.setCancellationReason(null);
        booking.setRescheduleReviewedBy(adminEmail);
        booking.setRescheduleReviewedAt(LocalDateTime.now());
        clearRescheduleRequestFields(booking);
        booking = bookingRepository.save(booking);

        if (lockedPricing.usedFallback()) {
            pricingSnapshotService.notifyAdminsMissingPricing(
                    booking.getStation(),
                    booking.getChargingPoint().getPointType(),
                    "Approved reschedule for booking " + booking.getReferenceId() + "."
            );
        }

        auditService.log("APPROVE_BOOKING_RESCHEDULE", "BOOKING", booking.getId(), adminEmail,
                "Reschedule approved for " + booking.getReferenceId() + " to " + formatDateTimeValue(requestedStartTime));

        notificationService.send(booking.getCustomer().getId(), "Reschedule Approved",
                "Your booking " + booking.getReferenceId() + " was rescheduled to " +
                        formatDateTimeValue(requestedStartTime) + ".");

        return toResponse(booking);
    }

    @Transactional
    public BookingResponse rejectRescheduleRequest(Long bookingId, String adminEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        booking = hydrate(booking);

        if (booking.getRescheduleRequestStatus() != RescheduleRequestStatus.PENDING) {
            throw new BadRequestException("No pending reschedule request for this booking");
        }

        booking.setRescheduleRequestStatus(RescheduleRequestStatus.REJECTED);
        booking.setRescheduleReviewedBy(adminEmail);
        booking.setRescheduleReviewedAt(LocalDateTime.now());
        booking = bookingRepository.save(booking);

        auditService.log("REJECT_BOOKING_RESCHEDULE", "BOOKING", booking.getId(), adminEmail,
                "Reschedule rejected for " + booking.getReferenceId());

        notificationService.send(booking.getCustomer().getId(), "Reschedule Rejected",
                "Your reschedule request for booking " + booking.getReferenceId() + " was not approved.");

        return toResponse(booking);
    }

    public Page<BookingResponse> getMyBookings(String email, Pageable pageable) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return withReferenceCache(() -> toBookingResponsePage(
                bookingRepository.findByCustomerIdOrderByCreatedAtDesc(customer.getId(), pageable), pageable));
    }

    public BookingResponse getBookingById(Long id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        return withReferenceCache(() -> toResponse(booking));
    }

    public Page<BookingResponse> getAllBookings(Pageable pageable, BookingStatus status) {
        return withReferenceCache(() -> {
            if (status == null) {
                return toBookingResponsePage(bookingRepository.findAllByOrderByCreatedAtDesc(pageable), pageable);
            }
            return toBookingResponsePage(bookingRepository.findByStatusOrderByCreatedAtDesc(status, pageable), pageable);
        });
    }

    public Page<BookingResponse> getBookingsByStation(Long stationId, Pageable pageable) {
        return withReferenceCache(() -> toBookingResponsePage(bookingRepository.findByStationId(stationId, pageable), pageable));
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
        ChargingPoint chargingPoint = cpRepository.findById(pointId)
                .orElseThrow(() -> new ResourceNotFoundException("Charging point not found"));
        chargingPoint = hydrate(chargingPoint);

        if (!chargingPoint.getStation().getId().equals(station.getId())) {
            throw new BadRequestException("Charging point does not belong to this station");
        }
        ensurePointAvailableForBooking(chargingPoint);

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

        for (ChargingPoint candidate : candidates) {
            ChargingPoint cp = hydrate(candidate);
            if (isPointBlockedForBooking(cp.getStatus())) continue;
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
        b = hydrate(b);
        User customer = b.getCustomer();
        Station station = b.getStation();
        ChargingPoint chargingPoint = b.getChargingPoint();
        UserVehicle bookingVehicle = resolveResponseVehicle(b);
        String vehicleNickname = bookingVehicle != null ? bookingVehicle.getVehicleNickname() : null;
        String vehicleMake = bookingVehicle != null ? bookingVehicle.getVehicleMake() : customer != null ? customer.getVehicleMake() : null;
        String vehicleModel = bookingVehicle != null ? bookingVehicle.getVehicleModel() : customer != null ? customer.getVehicleModel() : null;
        String vehicleRegistration = bookingVehicle != null
                ? bookingVehicle.getVehicleRegistration()
                : customer != null ? customer.getVehicleRegistration() : null;

        return BookingResponse.builder()
                .id(b.getId())
                .referenceId(b.getReferenceId())
                .customerId(customer != null ? customer.getId() : b.getCustomerId())
                .customerName(customer != null ? customer.getFullName() : null)
                .stationId(station != null ? station.getId() : b.getStationId())
                .stationName(station != null ? station.getName() : null)
                .chargingPointId(chargingPoint != null ? chargingPoint.getId() : b.getChargingPointId())
                .chargingPointIdentifier(chargingPoint != null ? chargingPoint.getIdentifier() : null)
                .pointType(chargingPoint != null && chargingPoint.getPointType() != null ? chargingPoint.getPointType().name() : null)
                .vehicleId(bookingVehicle != null ? bookingVehicle.getId() : null)
                .vehicleNickname(vehicleNickname)
                .vehicleMake(vehicleMake)
                .vehicleModel(vehicleModel)
                .vehicleRegistration(vehicleRegistration)
                .startTime(b.getStartTime())
                .endTime(b.getEndTime())
                .lockedRatePerUnit(b.getLockedRatePerUnit())
                .lockedRateType(b.getLockedRateType())
                .status(b.getStatus() != null ? b.getStatus().name() : null)
                .cancellationReason(b.getCancellationReason())
                .rescheduleRequestStatus((b.getRescheduleRequestStatus() != null ? b.getRescheduleRequestStatus() : RescheduleRequestStatus.NONE).name())
                .rescheduleRequestedStartTime(b.getRescheduleRequestedStartTime())
                .rescheduleRequestedEndTime(b.getRescheduleRequestedEndTime())
                .rescheduleRequestReason(b.getRescheduleRequestReason())
                .rescheduleRequestedAt(b.getRescheduleRequestedAt())
                .rescheduleReviewedAt(b.getRescheduleReviewedAt())
                .rescheduleReviewedBy(b.getRescheduleReviewedBy())
                .createdAt(b.getCreatedAt())
                .updatedAt(b.getUpdatedAt())
                .build();
    }

    private UserVehicle resolveResponseVehicle(Booking booking) {
        if (booking.getVehicle() != null) {
            return booking.getVehicle();
        }

        Long customerId = booking.getCustomer() != null ? booking.getCustomer().getId() : booking.getCustomerId();
        if (customerId == null) {
            return null;
        }

        return referenceResolver != null
                ? referenceResolver.resolveFirstVehicleForUser(customerId)
                : userVehicleRepository.findFirstByUserIdOrderByCreatedAtAscIdAsc(customerId).orElse(null);
    }

    private void validateRescheduleSlot(Booking booking, LocalDateTime requestedStartTime, LocalDateTime requestedEndTime) {
        if (requestedStartTime == null) {
            throw new BadRequestException("Requested start time is required");
        }

        if (!booking.getStation().getActive()) {
            throw new BadRequestException("Station is currently inactive");
        }

        ensurePointAvailableForBooking(booking.getChargingPoint());

        validateOperatingHours(booking.getStation(), requestedStartTime, requestedEndTime);

        if (!requestedStartTime.isAfter(LocalDateTime.now())) {
            throw new BadRequestException("Rescheduled start time must be in the future");
        }

        if (requestedStartTime.equals(booking.getStartTime()) && requestedEndTime.equals(booking.getEndTime())) {
            throw new BadRequestException("Please select a different slot for reschedule");
        }

        List<Booking> overlapping = bookingRepository.findOverlappingBookingsExcluding(
                booking.getChargingPoint().getId(), requestedStartTime, requestedEndTime, booking.getId());
        if (!overlapping.isEmpty()) {
            throw new ConflictException("Requested time slot conflicts with existing bookings");
        }
    }

    private int getBookingDurationMinutes(Booking booking) {
        long duration = Duration.between(booking.getStartTime(), booking.getEndTime()).toMinutes();
        return duration > 0 ? (int) duration : 60;
    }

    private void clearRescheduleRequestFields(Booking booking) {
        booking.setRescheduleRequestStatus(RescheduleRequestStatus.NONE);
        booking.setRescheduleRequestedStartTime(null);
        booking.setRescheduleRequestedEndTime(null);
        booking.setRescheduleRequestReason(null);
        booking.setRescheduleRequestedAt(null);
    }

    private void resetRescheduleReview(Booking booking) {
        booking.setRescheduleReviewedAt(null);
        booking.setRescheduleReviewedBy(null);
    }

    private String formatDateTimeValue(LocalDateTime value) {
        if (value == null) return "-";
        return value.format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm"));
    }

    private void notifyAdmins(String title, String message) {
        List<User> admins = userRepository.findByRole(Role.ADMIN);
        for (User admin : admins) {
            try {
                notificationService.send(admin.getId(), title, message);
            } catch (Exception ex) {
                log.warn("Failed to notify admin {} for booking workflow", admin.getId(), ex);
            }
        }
    }

    private boolean isPointBlockedForBooking(PointStatus status) {
        return status == PointStatus.OUT_OF_SERVICE || status == PointStatus.UNAVAILABLE;
    }

    private Booking hydrate(Booking booking) {
        return referenceResolver != null ? referenceResolver.hydrate(booking) : booking;
    }

    private ChargingPoint hydrate(ChargingPoint chargingPoint) {
        return referenceResolver != null ? referenceResolver.hydrate(chargingPoint) : chargingPoint;
    }

    private <T> T withReferenceCache(Supplier<T> supplier) {
        return referenceResolver != null ? referenceResolver.withCache(supplier) : supplier.get();
    }

    private Page<BookingResponse> toBookingResponsePage(Page<Booking> page, Pageable pageable) {
        List<Booking> bookings = page.getContent();
        if (referenceResolver != null) {
            referenceResolver.preloadForBookings(bookings);
        }
        List<BookingResponse> content = bookings.stream().map(this::toResponse).toList();
        return new PageImpl<>(content, pageable, page.getTotalElements());
    }

    private void ensurePointAvailableForBooking(ChargingPoint chargingPoint) {
        if (chargingPoint == null) {
            throw new ResourceNotFoundException("Charging point not found");
        }
        if (isPointBlockedForBooking(chargingPoint.getStatus())) {
            throw new BadRequestException("Charging point is currently unavailable for booking");
        }
    }

    private UserVehicle resolveActiveVehicle(User customer) {
        UserVehicle activeVehicle = userVehicleRepository.findFirstByUserIdAndActiveTrue(customer.getId()).orElse(null);
        if (activeVehicle != null) {
            return activeVehicle;
        }

        List<UserVehicle> vehicles = userVehicleRepository.findByUserIdOrderByActiveDescCreatedAtDesc(customer.getId());
        if (!vehicles.isEmpty()) {
            UserVehicle first = vehicles.get(0);
            first.setActive(true);
            return userVehicleRepository.save(first);
        }

        if (!hasVehicleDetails(customer)) {
            return null;
        }

        UserVehicle created = UserVehicle.builder()
                .user(customer)
                .vehicleMake(normalizeText(customer.getVehicleMake()))
                .vehicleModel(normalizeText(customer.getVehicleModel()))
                .vehicleRegistration(normalizeRegistration(customer.getVehicleRegistration()))
                .active(true)
                .build();

        return userVehicleRepository.save(created);
    }

    private boolean hasVehicleDetails(User user) {
        return normalizeText(user.getVehicleMake()) != null
                && normalizeText(user.getVehicleModel()) != null
                && normalizeRegistration(user.getVehicleRegistration()) != null;
    }

    private String normalizeText(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeRegistration(String value) {
        if (value == null) return null;
        String normalized = value.toUpperCase().replaceAll("[\\s-]", "").trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
