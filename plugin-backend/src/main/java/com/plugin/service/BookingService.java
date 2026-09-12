package com.plugin.service;

import com.plugin.config.AppClock;
import com.plugin.dto.request.BookingLocationPingRequest;
import com.plugin.dto.request.BookingRequest;
import com.plugin.dto.request.BookingRescheduleRequest;
import com.plugin.dto.response.BookingResponse;
import com.plugin.entity.*;
import com.plugin.enums.*;
import com.plugin.exception.*;
import com.plugin.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

@Service
@Slf4j
@RequiredArgsConstructor
public class BookingService {

    private static final int ETA_GRACE_BUFFER_MINUTES = 20;
    private static final double PROXIMITY_LOCK_DISTANCE_METERS = 1609.344;
    private static final long LOCATION_PING_RATE_LIMIT_SECONDS = 30;
    private static final double MAX_PLAUSIBLE_SPEED_METERS_PER_SECOND = 75.0;
    private static final double IMPOSSIBLE_JUMP_METERS = 80_467.2;

    private final BookingRepository bookingRepository;
    private final StationRepository stationRepository;
    private final ChargingPointRepository cpRepository;
    private final UserRepository userRepository;
    private final UserVehicleRepository userVehicleRepository;
    private final PricingSnapshotService pricingSnapshotService;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final EntityReferenceResolver referenceResolver;
    private final ChargingSessionRepository sessionRepository;
    private final EtaService etaService;
    private final BookingTransactionRunner transactionRunner;
    private final EtaSlotAllocator etaSlotAllocator;
    private final ChargingImpactService chargingImpactService;

    @Value("${app.notifications.booking-start-lookback-minutes:180}")
    private long bookingStartNotificationLookbackMinutes;

    public BookingResponse createBooking(BookingRequest request, String customerEmail) {
        return transactionRunner.execute(() -> createBookingOnce(request, customerEmail));
    }

    private BookingResponse createBookingOnce(BookingRequest request, String customerEmail) {
        User customer = userRepository.findByEmail(customerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
        transactionRunner.claimCustomer(customer.getId());
        if (request.getRequestKey() != null) {
            Booking previous = bookingRepository.findByCustomerIdAndRequestKey(customer.getId(), request.getRequestKey()).orElse(null);
            if (previous != null) {
                if (!requestFingerprint(request).equals(previous.getRequestFingerprint())) {
                    throw new ConflictException("This booking request was already used with different details.");
                }
                return toResponse(previous);
            }
        }
        if (bookingRepository.existsActiveByCustomerId(
                customer.getId(), AppClock.toStoredScheduleTime(AppClock.now()))) {
            throw new ConflictException("Complete or cancel your active booking before creating another one");
        }
        UserVehicle activeVehicle = resolveActiveVehicle(customer);
        if (activeVehicle == null) {
            throw new BadRequestException("Please add a vehicle in your profile before booking a charging session");
        }

        Station station = stationRepository.findById(request.getStationId())
                .orElseThrow(() -> new ResourceNotFoundException("Station not found"));

        if (!station.getActive()) {
            throw new BadRequestException("Station is currently inactive");
        }

        boolean dynamicEtaBooking = Boolean.TRUE.equals(request.getDynamicEta())
                || (request.getDynamicEta() == null && hasOriginCoordinates(request) && request.getStartTime() == null);
        if (dynamicEtaBooking && request.getStartTime() != null) {
            throw new BadRequestException("Choose either charge on arrival or a scheduled start time.");
        }
        PointType requestedPointType = resolvePointTypePreference(station.getId(), request.getPointTypePreference());
        LocalDateTime startTime;
        LocalDateTime endTime;
        LocalDateTime predictedArrivalAt = null;
        LocalDateTime gracePeriodEndTime = null;
        Long etaSeconds = null;
        Double lastDistanceMeters = null;
        Boolean etaLiveTraffic = null;
        LocalDateTime holdExpiresAt = null;
        LocalDateTime reservedUntil = null;
        LocalDateTime acceptedPingAt = dynamicEtaBooking ? AppClock.now().withNano(0) : null;

        if (dynamicEtaBooking) {
            ensureValidCoordinates(request.getOriginLatitude(), request.getOriginLongitude());
            ensureStationHasCoordinates(station);
            EtaService.EtaResult eta = etaService.estimate(
                    request.getOriginLatitude(),
                    request.getOriginLongitude(),
                    station.getLatitude(),
                    station.getLongitude()
            );
            etaSeconds = eta.durationSeconds();
            etaLiveTraffic = eta.liveTraffic();
            lastDistanceMeters = EtaService.distanceMeters(request.getOriginLatitude(), request.getOriginLongitude(),
                    station.getLatitude(), station.getLongitude());
            predictedArrivalAt = acceptedPingAt.plusSeconds(eta.durationSeconds()).withNano(0);
            gracePeriodEndTime = predictedArrivalAt.plusMinutes(ETA_GRACE_BUFFER_MINUTES).withNano(0);
            startTime = predictedArrivalAt;
            endTime = predictedArrivalAt.plusMinutes(request.getDurationMinutes()).withNano(0);
            holdExpiresAt = acceptedPingAt.plusMinutes(EtaSlotAllocator.MAX_HOLD_MINUTES);
        } else {
            if (request.getStartTime() == null) {
                throw new BadRequestException("Booking start time is required");
            }
            startTime = request.getStartTime();
            endTime = startTime.plusMinutes(request.getDurationMinutes());
        }

        LocalDateTime storedStartTime = AppClock.toStoredScheduleTime(startTime);
        LocalDateTime storedEndTime = AppClock.toStoredScheduleTime(endTime);
        LocalDateTime storedPredictedArrivalAt = AppClock.toStoredScheduleTime(predictedArrivalAt);
        LocalDateTime storedGracePeriodEndTime = AppClock.toStoredScheduleTime(gracePeriodEndTime);

        // Validate within operating hours
        validateOperatingHours(station, startTime, endTime);

        // Validate start time is in the future
        if (startTime.isBefore(AppClock.now())) {
            throw new BadRequestException("Booking start time must be in the future");
        }

        ChargingPoint chargingPoint = null;

        if (dynamicEtaBooking) {
            EtaSlotAllocator.Slot slot = etaSlotAllocator.allocate(station, requestedPointType, predictedArrivalAt,
                    request.getDurationMinutes(), holdExpiresAt.minusMinutes(ETA_GRACE_BUFFER_MINUTES), null);
            chargingPoint = slot.point();
            startTime = slot.start();
            endTime = slot.end();
            reservedUntil = slot.reservedUntil();
            gracePeriodEndTime = startTime.plusMinutes(ETA_GRACE_BUFFER_MINUTES);
            storedStartTime = AppClock.toStoredScheduleTime(startTime);
            storedEndTime = AppClock.toStoredScheduleTime(endTime);
            storedGracePeriodEndTime = AppClock.toStoredScheduleTime(gracePeriodEndTime);
        } else if (request.getChargingPointId() != null) {
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
                    chargingPoint.getId(), storedStartTime, storedEndTime);
            if (!overlapping.isEmpty()) {
                throw new ConflictException("Time slot is already booked for this charging point");
            }
            requestedPointType = chargingPoint.getPointType();
        } else {
            // Auto-assign: find an available charging point
            chargingPoint = autoAssignPoint(station.getId(), request.getPointTypePreference(), startTime, endTime);
            requestedPointType = chargingPoint.getPointType();
        }

        String refId = generateReferenceId();
        PricingSnapshotService.PricingSnapshot lockedPricing =
                pricingSnapshotService.resolveFor(station, requestedPointType);
        ChargingImpactService.ChargingImpact impact = resolveChargingImpact(
                request, station, startTime, endTime, chargingPoint);

        Booking booking = Booking.builder()
                .referenceId(refId)
                .customer(customer)
                .station(station)
                .chargingPoint(chargingPoint)
                .chargingPointId(chargingPoint != null ? chargingPoint.getId() : null)
                .assignedChargingPointId(null)
                .virtualSpot(dynamicEtaBooking)
                .proximityLocked(false)
                .vehicle(activeVehicle)
                .startTime(storedStartTime)
                .endTime(storedEndTime)
                .reservedUntil(AppClock.toStoredScheduleTime(reservedUntil))
                .holdExpiresAt(AppClock.toStoredScheduleTime(holdExpiresAt))
                .etaLiveTraffic(etaLiveTraffic)
                .requestKey(request.getRequestKey())
                .requestFingerprint(requestFingerprint(request))
                .requestedDurationMinutes(request.getDurationMinutes())
                .originLatitude(dynamicEtaBooking ? request.getOriginLatitude() : null)
                .originLongitude(dynamicEtaBooking ? request.getOriginLongitude() : null)
                .lastKnownLatitude(dynamicEtaBooking ? request.getOriginLatitude() : null)
                .lastKnownLongitude(dynamicEtaBooking ? request.getOriginLongitude() : null)
                .lastLocationPingAt(acceptedPingAt)
                .predictedArrivalAt(storedPredictedArrivalAt)
                .gracePeriodEndTime(storedGracePeriodEndTime)
                .etaSeconds(etaSeconds)
                .lastDistanceMeters(lastDistanceMeters)
                .pointTypePreference(requestedPointType != null ? requestedPointType.name() : null)
                .lockedRatePerUnit(lockedPricing.ratePerUnit())
                .lockedRateType(lockedPricing.rateType())
                .chargingPreference(impact != null ? impact.preference() : null)
                .requestedEnergyKwh(impact != null ? impact.requestedEnergyKwh() : null)
                .expectedRenewableSharePercent(impact != null ? impact.renewableSharePercent() : null)
                .expectedCarbonKg(impact != null ? impact.carbonKg() : null)
                .estimatedCarbonSavedKg(impact != null ? impact.carbonSavedKg() : null)
                .greenScore(impact != null ? impact.greenScore() : null)
                .energyDataMode(impact != null ? impact.dataMode() : null)
                .energySource(impact != null ? impact.source() : null)
                .energyQuality(impact != null ? impact.quality() : null)
                .energyCapturedAt(impact != null ? impact.capturedAt() : null)
                .status(BookingStatus.CONFIRMED)
                .startNotificationSent(false)
                .build();

        if (chargingPoint != null && !dynamicEtaBooking) {
            // All future-schedule changes touch the connector document so concurrent
            // Mongo transactions contend on one authoritative resource.
            cpRepository.touchSchedule(chargingPoint.getId());
        }
        booking = bookingRepository.save(booking);
        if (dynamicEtaBooking && lastDistanceMeters <= PROXIMITY_LOCK_DISTANCE_METERS) {
            Booking locked = lockPhysicalPointForBooking(booking);
            if (locked != null) booking = locked;
        }

        if (lockedPricing.usedFallback()) {
            pricingSnapshotService.notifyAdminsMissingPricing(
                    station,
                    requestedPointType,
                    "Booking " + refId + " was created by " + customerEmail + "."
            );
        }

        auditService.log("CREATE_BOOKING", "BOOKING", booking.getId(), customerEmail,
                "Booking created: " + refId);

        notificationService.send(customer.getId(), "Booking Confirmed",
                "Your booking " + refId + " at " + station.getName() +
                (dynamicEtaBooking
                        ? " has a reserved charging window at " + startTime.format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm"))
                        + ". Arrive by " +
                        gracePeriodEndTime.format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm")) + "."
                        : " is confirmed for " + startTime.format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm"))));

        return toResponse(booking);
    }

    @Transactional
    public BookingResponse modifyBooking(Long bookingId, BookingRequest request, String customerEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        booking = hydrate(booking);

        if (!isBookingOwnedBy(booking, customerEmail)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Cannot modify a " + booking.getStatus() + " booking");
        }
        if (booking.getStatus() == BookingStatus.IN_PROGRESS
                || sessionRepository.findByBookingId(bookingId)
                .filter(session -> session.getStatus() == SessionStatus.IN_PROGRESS).isPresent()) {
            throw new BadRequestException("Cannot modify a booking after charging has started");
        }

        if (Boolean.TRUE.equals(booking.getVirtualSpot()) || booking.getGracePeriodEndTime() != null) {
            throw new BadRequestException("Dynamic ETA bookings update automatically from your location.");
        }

        if (AppClock.fromStoredScheduleTime(booking.getStartTime()).isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Cannot modify a booking that has already started");
        }

        LocalDateTime startTime = request.getStartTime();
        LocalDateTime endTime = startTime.plusMinutes(request.getDurationMinutes());
        LocalDateTime storedStartTime = AppClock.toStoredScheduleTime(startTime);
        LocalDateTime storedEndTime = AppClock.toStoredScheduleTime(endTime);

        Station station = booking.getStation();
        validateOperatingHours(station, startTime, endTime);

        if (startTime.isBefore(AppClock.now())) {
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
                pointId, storedStartTime, storedEndTime, booking.getId());
        if (!overlapping.isEmpty()) {
            throw new ConflictException("New time slot conflicts with existing bookings");
        }
        cpRepository.touchSchedule(pointId);

        if (request.getChargingPointId() != null) {
            booking.setChargingPoint(targetPoint);
        }

        booking.setStartTime(storedStartTime);
        booking.setEndTime(storedEndTime);
        PricingSnapshotService.PricingSnapshot lockedPricing =
                pricingSnapshotService.resolveFor(booking.getStation(), booking.getChargingPoint().getPointType());
        booking.setLockedRatePerUnit(lockedPricing.ratePerUnit());
        booking.setLockedRateType(lockedPricing.rateType());
        booking.setStatus(BookingStatus.MODIFIED);
        booking.setStartNotificationSent(false);
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

        if (!isBookingOwnedBy(booking, customerEmail)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Cannot reschedule a " + booking.getStatus() + " booking");
        }
        if (booking.getStatus() == BookingStatus.IN_PROGRESS
                || sessionRepository.findByBookingId(bookingId)
                .filter(session -> session.getStatus() == SessionStatus.IN_PROGRESS).isPresent()) {
            throw new BadRequestException("Cannot reschedule a booking after charging has started");
        }

        if (!AppClock.fromStoredScheduleTime(booking.getStartTime()).isAfter(LocalDateTime.now())) {
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
        LocalDateTime storedRequestedStartTime = AppClock.toStoredScheduleTime(requestedStartTime);
        LocalDateTime storedRequestedEndTime = AppClock.toStoredScheduleTime(requestedEndTime);

        validateRescheduleSlot(booking, requestedStartTime, requestedEndTime);
        cpRepository.touchSchedule(booking.getChargingPoint().getId());

        booking.setRescheduleRequestStatus(RescheduleRequestStatus.PENDING);
        booking.setRescheduleRequestedStartTime(storedRequestedStartTime);
        booking.setRescheduleRequestedEndTime(storedRequestedEndTime);
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

        if (!isBookingOwnedBy(booking, customerEmail)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        if (booking.getStatus() == BookingStatus.IN_PROGRESS
                || sessionRepository.findByBookingId(bookingId)
                .filter(session -> session.getStatus() == SessionStatus.IN_PROGRESS).isPresent()) {
            throw new BadRequestException("Cannot cancel a booking after charging has started");
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

        releaseReservedPointIfNeeded(booking);
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(normalizedReason);
        BookingLocationPrivacy.clearPreciseLocation(booking);
        clearRescheduleRequestFields(booking);
        resetRescheduleReview(booking);
        booking = bookingRepository.save(booking);

        auditService.log("CANCEL_BOOKING", "BOOKING", booking.getId(), customerEmail,
                "Booking cancelled: " + booking.getReferenceId() + ". Reason: " + normalizedReason);

        notificationService.send(booking.getCustomer().getId(), "Booking Cancelled",
                "Your booking " + booking.getReferenceId() + " has been cancelled. Reason: " + normalizedReason);

        return toResponse(booking);
    }

    public BookingResponse updateBookingLocation(Long bookingId, BookingLocationPingRequest request, String customerEmail) {
        return transactionRunner.execute(() -> updateBookingLocationOnce(bookingId, request, customerEmail));
    }

    private BookingResponse updateBookingLocationOnce(Long bookingId, BookingLocationPingRequest request, String customerEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        booking = hydrate(booking);

        if (!isBookingOwnedBy(booking, customerEmail)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        if (!Boolean.TRUE.equals(booking.getVirtualSpot()) && booking.getGracePeriodEndTime() == null) {
            throw new BadRequestException("Location updates are only accepted for ETA bookings");
        }

        if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.MODIFIED) {
            return toResponse(booking);
        }

        ensureValidCoordinates(request.getLatitude(), request.getLongitude());
        LocalDateTime now = AppClock.now().withNano(0);
        if ((booking.getGracePeriodEndTime() != null && !now.isBefore(AppClock.fromStoredScheduleTime(booking.getGracePeriodEndTime())))
                || (booking.getHoldExpiresAt() != null && !now.isBefore(AppClock.fromStoredScheduleTime(booking.getHoldExpiresAt())))) {
            return toResponse(expireMissedBooking(booking, "The ETA arrival deadline expired."));
        }
        if (isLocationPingRateLimited(booking, now)) {
            return toResponse(booking);
        }

        if (!isPlausibleLocationMove(booking, request.getLatitude(), request.getLongitude(), now)) {
            log.warn("Ignored implausible location ping for booking {}", booking.getId());
            return toResponse(booking);
        }

        Station station = booking.getStation();
        if (!Boolean.TRUE.equals(station.getActive())) {
            return toResponse(expireMissedBooking(booking, "The station is no longer available."));
        }
        ensureStationHasCoordinates(station);
        EtaService.EtaResult eta = etaService.estimate(
                request.getLatitude(),
                request.getLongitude(),
                station.getLatitude(),
                station.getLongitude()
        );

        booking.setLastKnownLatitude(request.getLatitude());
        booking.setLastKnownLongitude(request.getLongitude());
        booking.setLastLocationPingAt(now);
        booking.setEtaSeconds(eta.durationSeconds());
        booking.setEtaLiveTraffic(eta.liveTraffic());
        double proximityDistance = EtaService.distanceMeters(request.getLatitude(), request.getLongitude(),
                station.getLatitude(), station.getLongitude());
        booking.setLastDistanceMeters(proximityDistance);
        if (Boolean.TRUE.equals(booking.getProximityLocked()) && proximityDistance > PROXIMITY_LOCK_DISTANCE_METERS) {
            releaseReservedPointIfNeeded(booking);
            booking.setProximityLocked(false);
            booking.setVirtualSpot(true);
            booking.setAssignedChargingPointId(null);
        }
        if (!Boolean.TRUE.equals(booking.getProximityLocked())) {
            LocalDateTime predictedArrivalAt = now.plusSeconds(eta.durationSeconds()).withNano(0);
            LocalDateTime holdLimit = booking.getHoldExpiresAt() != null
                    ? AppClock.fromStoredScheduleTime(booking.getHoldExpiresAt())
                    : AppClock.fromStoredScheduleTime(booking.getGracePeriodEndTime());
            EtaSlotAllocator.Slot slot;
            try {
                slot = etaSlotAllocator.allocate(station, parsePointTypeOrNull(booking.getPointTypePreference()),
                        predictedArrivalAt, resolveRequestedDurationMinutes(booking),
                        holdLimit.minusMinutes(ETA_GRACE_BUFFER_MINUTES), booking.getId());
            } catch (ConflictException | BadRequestException unavailable) {
                return toResponse(expireMissedBooking(booking, unavailable.getMessage()));
            }
            if (booking.getChargingPointId() != null && !booking.getChargingPointId().equals(slot.point().getId())) {
                cpRepository.touchSchedule(booking.getChargingPointId());
            }
            LocalDateTime gracePeriodEndTime = slot.start().plusMinutes(ETA_GRACE_BUFFER_MINUTES);
            booking.setChargingPoint(slot.point());
            booking.setChargingPointId(slot.point().getId());
            booking.setPredictedArrivalAt(AppClock.toStoredScheduleTime(predictedArrivalAt));
            booking.setGracePeriodEndTime(AppClock.toStoredScheduleTime(gracePeriodEndTime));
            booking.setStartTime(AppClock.toStoredScheduleTime(slot.start()));
            booking.setEndTime(AppClock.toStoredScheduleTime(slot.end()));
            booking.setReservedUntil(AppClock.toStoredScheduleTime(slot.reservedUntil()));
            booking.setStartNotificationSent(false);
        }

        if (proximityDistance <= PROXIMITY_LOCK_DISTANCE_METERS && !Boolean.TRUE.equals(booking.getProximityLocked())) {
            Booking lockedBooking = lockPhysicalPointForBooking(booking);
            if (lockedBooking != null) {
                return toResponse(lockedBooking);
            }
        }

        return toResponse(bookingRepository.save(booking));
    }

    @Transactional
    public BookingResponse cancelBookingAsAdmin(Long bookingId, String adminEmail, String reason) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        booking = hydrate(booking);

        if (booking.getStatus() == BookingStatus.IN_PROGRESS
                || sessionRepository.findByBookingId(bookingId)
                .filter(session -> session.getStatus() == SessionStatus.IN_PROGRESS).isPresent()) {
            throw new BadRequestException("Cannot cancel a booking after charging has started");
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

        releaseReservedPointIfNeeded(booking);
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(normalizedReason);
        BookingLocationPrivacy.clearPreciseLocation(booking);
        clearRescheduleRequestFields(booking);
        resetRescheduleReview(booking);
        booking = bookingRepository.save(booking);

        auditService.log("CANCEL_BOOKING", "BOOKING", booking.getId(), adminEmail,
                "Booking cancelled by admin: " + booking.getReferenceId() + ". Reason: " + normalizedReason);

        try {
            notificationService.send(booking.getCustomer().getId(), "Booking Cancelled",
                    "Your booking " + booking.getReferenceId() + " has been cancelled by admin. Reason: " + normalizedReason);
        } catch (Exception ex) {
            log.warn("Failed to send cancel notification for booking {}; type={}",
                    booking.getId(), ex.getClass().getName());
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

        LocalDateTime storedRequestedStartTime = booking.getRescheduleRequestedStartTime();
        LocalDateTime storedRequestedEndTime = booking.getRescheduleRequestedEndTime();
        if (storedRequestedStartTime == null || storedRequestedEndTime == null) {
            throw new BadRequestException("Requested reschedule slot is incomplete");
        }
        LocalDateTime requestedStartTime = AppClock.fromStoredScheduleTime(storedRequestedStartTime);
        LocalDateTime requestedEndTime = AppClock.fromStoredScheduleTime(storedRequestedEndTime);

        validateRescheduleSlot(booking, requestedStartTime, requestedEndTime);

        cpRepository.touchSchedule(booking.getChargingPoint().getId());
        PricingSnapshotService.PricingSnapshot lockedPricing =
                pricingSnapshotService.resolveFor(booking.getStation(), booking.getChargingPoint().getPointType());

        booking.setStartTime(storedRequestedStartTime);
        booking.setEndTime(storedRequestedEndTime);
        booking.setLockedRatePerUnit(lockedPricing.ratePerUnit());
        booking.setLockedRateType(lockedPricing.rateType());
        booking.setStatus(BookingStatus.MODIFIED);
        booking.setStartNotificationSent(false);
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

    public BookingResponse getBookingForCaller(Long id, String actorEmail) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        User actor = userRepository.findByEmail(actorEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Long customerId = booking.getCustomerId() != null
                ? booking.getCustomerId()
                : booking.getCustomer() != null ? booking.getCustomer().getId() : null;
        if (actor.getRole() != Role.ADMIN && !actor.getId().equals(customerId)) {
            throw new ResourceNotFoundException("Booking not found");
        }
        return withReferenceCache(() -> toResponse(booking));
    }

    @Transactional
    public void sendBookingStartNotifications() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime from = now.minusMinutes(Math.max(1, bookingStartNotificationLookbackMinutes));
        LocalDateTime storedNow = AppClock.toStoredScheduleTime(now);
        LocalDateTime storedFrom = AppClock.toStoredScheduleTime(from);
        List<Booking> dueBookings = bookingRepository.findDueStartNotifications(
                List.of(BookingStatus.CONFIRMED, BookingStatus.MODIFIED), storedFrom, storedNow);

        for (Booking booking : dueBookings) {
            Booking hydrated = hydrate(booking);
            Long customerId = hydrated.getCustomer() != null ? hydrated.getCustomer().getId() : hydrated.getCustomerId();
            if (customerId == null) {
                log.warn("Skipping start notification for booking {} because customer is missing", hydrated.getId());
                continue;
            }

            String stationName = hydrated.getStation() != null && hydrated.getStation().getName() != null
                    ? hydrated.getStation().getName()
                    : "your station";
            try {
                String selectedTime = hydrated.getStartTime() != null
                        ? AppClock.fromStoredScheduleTime(hydrated.getStartTime()).format(DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a"))
                        : "your selected time";
                notificationService.send(customerId, "Session Time Arrived",
                        "Your booking " + hydrated.getReferenceId() + " at " + stationName +
                                " has a charging window starting at " + selectedTime +
                                ". Open My Bookings to check your connector and refresh your location before starting.");
                hydrated.setStartNotificationSent(true);
                bookingRepository.save(hydrated);
            } catch (Exception ex) {
                log.warn("Failed to send start notification for booking {}; type={}",
                        hydrated.getId(), ex.getClass().getName());
            }
        }
    }

    @Transactional
    public void expireMissedBookings() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime storedNow = AppClock.toStoredScheduleTime(now);
        List<Booking> expiredBookings = bookingRepository.findExpiredStartableBookings(
                List.of(BookingStatus.CONFIRMED, BookingStatus.MODIFIED), storedNow);

        for (Booking booking : expiredBookings) {
            Booking hydrated = hydrate(booking);
            if (hydrated.getId() != null && sessionRepository.findByBookingId(hydrated.getId()).isPresent()) {
                continue;
            }
            String reason = hydrated.getGracePeriodEndTime() != null
                    ? "Booking expired because the ETA grace period ended."
                    : "Booking expired because the reserved charging window was missed.";
            expireMissedBooking(hydrated, reason);
        }
    }

    private Booking expireMissedBooking(Booking booking, String reason) {
        if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.MODIFIED) {
            return booking;
        }

        releaseReservedPointIfNeeded(booking);
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(reason);
        BookingLocationPrivacy.clearPreciseLocation(booking);
        booking = bookingRepository.save(booking);

        Long customerId = booking.getCustomer() != null ? booking.getCustomer().getId() : booking.getCustomerId();
        if (customerId != null) {
            String stationName = booking.getStation() != null && booking.getStation().getName() != null
                    ? booking.getStation().getName()
                    : "your station";
            try {
                notificationService.send(customerId, "Booking Cancelled",
                        "Your booking " + booking.getReferenceId() + " at " + stationName +
                                " was cancelled because the selected charging time was missed.");
            } catch (Exception ex) {
                log.warn("Failed to send missed booking notification for booking {}; type={}",
                        booking.getId(), ex.getClass().getName());
            }
        }

        try {
            auditService.log("EXPIRE_BOOKING", "BOOKING", booking.getId(), "system",
                    "Booking expired automatically: " + booking.getReferenceId());
        } catch (Exception ex) {
            log.warn("Failed to write missed booking audit log for booking {}; type={}",
                    booking.getId(), ex.getClass().getName());
        }

        return booking;
    }

    private Booking lockPhysicalPointForBooking(Booking booking) {
        // A later calendar reservation must not block a customer using an earlier window now.
        LocalDateTime now = AppClock.now().withNano(0);
        if (AppClock.fromStoredScheduleTime(booking.getStartTime()).isAfter(now.plusMinutes(2))) return null;
        Station station = booking.getStation();
        PointType preferredPointType = parsePointTypeOrNull(booking.getPointTypePreference());
        List<ChargingPoint> candidates = booking.getChargingPointId() != null
                ? cpRepository.findById(booking.getChargingPointId()).map(List::of).orElse(List.of())
                : preferredPointType != null
                ? cpRepository.findByStationIdAndPointType(station.getId(), preferredPointType)
                : cpRepository.findByStationId(station.getId());
        ChargingPoint lockedPoint = null;
        for (ChargingPoint candidate : candidates) {
            ChargingPoint current = cpRepository.findById(candidate.getId()).orElse(null);
            if (current == null || current.getStatus() != PointStatus.AVAILABLE) {
                continue;
            }
            List<Booking> overlaps = bookingRepository.findOverlappingBookingsExcluding(
                    current.getId(), AppClock.toStoredScheduleTime(now), EtaSlotAllocator.reservationEnd(booking), booking.getId());
            if (!overlaps.isEmpty()) {
                continue;
            }
            lockedPoint = cpRepository.reserveAvailablePoint(current.getId(), booking.getId());
            if (lockedPoint != null) {
                break;
            }
        }

        if (lockedPoint == null) {
            log.warn("No available physical charging point to lock for booking {}", booking.getId());
            return null;
        }

        lockedPoint = hydrate(lockedPoint);
        booking.setChargingPoint(lockedPoint);
        booking.setChargingPointId(lockedPoint.getId());
        booking.setAssignedChargingPointId(lockedPoint.getId());
        booking.setProximityLocked(true);
        booking.setVirtualSpot(false);
        booking.setPointTypePreference(lockedPoint.getPointType() != null ? lockedPoint.getPointType().name() : booking.getPointTypePreference());

        try {
            Booking saved = bookingRepository.save(booking);
            try {
                auditService.log("PROXIMITY_LOCK_BOOKING", "BOOKING", saved.getId(), "system",
                        "Assigned charging point " + lockedPoint.getIdentifier() + " to booking " + saved.getReferenceId());
            } catch (Exception ex) {
                log.warn("Failed to write proximity lock audit log for booking {}; type={}",
                        saved.getId(), ex.getClass().getName());
            }
            try {
                Long customerId = saved.getCustomer() != null ? saved.getCustomer().getId() : saved.getCustomerId();
                if (customerId != null) {
                    notificationService.send(customerId, "Connector Assigned",
                            "You are near " + station.getName() + ". Charging point " +
                                    lockedPoint.getIdentifier() + " is now assigned to your booking.");
                }
            } catch (Exception ex) {
                log.warn("Failed to send proximity lock notification for booking {}; type={}",
                        saved.getId(), ex.getClass().getName());
            }
            return saved;
        } catch (RuntimeException ex) {
            cpRepository.releaseReservationForBooking(lockedPoint.getId(), booking.getId());
            throw ex;
        }
    }

    private void releaseReservedPointIfNeeded(Booking booking) {
        Long bookingId = booking.getId();
        if (bookingId != null && sessionRepository.findByBookingId(bookingId).isPresent()) {
            return;
        }

        Long pointId = booking.getAssignedChargingPointId() != null
                ? booking.getAssignedChargingPointId()
                : booking.getChargingPointId();
        if (pointId == null) {
            return;
        }

        cpRepository.releaseReservationForBooking(pointId, booking.getId());
    }

    private boolean hasOriginCoordinates(BookingRequest request) {
        return request.getOriginLatitude() != null && request.getOriginLongitude() != null;
    }

    private void ensureValidCoordinates(Double latitude, Double longitude) {
        if (latitude == null || longitude == null
                || !Double.isFinite(latitude) || !Double.isFinite(longitude)
                || latitude < -90 || latitude > 90
                || longitude < -180 || longitude > 180) {
            throw new BadRequestException("Valid latitude and longitude are required");
        }
    }

    private void ensureStationHasCoordinates(Station station) {
        if (station == null || station.getLatitude() == null || station.getLongitude() == null) {
            throw new BadRequestException("Station location is not configured for ETA booking");
        }
        ensureValidCoordinates(station.getLatitude(), station.getLongitude());
    }

    private boolean isLocationPingRateLimited(Booking booking, LocalDateTime now) {
        LocalDateTime latest = booking.getLastLocationPingAt();
        if (latest == null) {
            return false;
        }
        long secondsSinceLastPing = Duration.between(latest, now).getSeconds();
        return secondsSinceLastPing >= 0 && secondsSinceLastPing < LOCATION_PING_RATE_LIMIT_SECONDS;
    }

    private boolean isPlausibleLocationMove(Booking booking, double latitude, double longitude, LocalDateTime now) {
        if (booking.getLastKnownLatitude() == null
                || booking.getLastKnownLongitude() == null
                || booking.getLastLocationPingAt() == null) {
            return true;
        }

        long seconds = Duration.between(booking.getLastLocationPingAt(), now).getSeconds();
        if (seconds <= 0) {
            return false;
        }

        double distanceMeters = EtaService.distanceMeters(
                booking.getLastKnownLatitude(),
                booking.getLastKnownLongitude(),
                latitude,
                longitude
        );
        if (distanceMeters > IMPOSSIBLE_JUMP_METERS && seconds <= 10) {
            return false;
        }
        return distanceMeters / Math.max(1, seconds) <= MAX_PLAUSIBLE_SPEED_METERS_PER_SECOND;
    }

    private int resolveRequestedDurationMinutes(Booking booking) {
        if (booking.getRequestedDurationMinutes() != null) {
            return Math.max(1, Math.min(60, booking.getRequestedDurationMinutes()));
        }
        return getBookingDurationMinutes(booking);
    }

    private PointType resolvePointTypePreference(Long stationId, String typePreference) {
        PointType parsed = parsePointTypeOrNull(typePreference);
        if (parsed != null) {
            return parsed;
        }
        return cpRepository.findByStationId(stationId).stream()
                .filter(point -> point.getPointType() != null)
                .findFirst()
                .map(ChargingPoint::getPointType)
                .orElseThrow(() -> new BadRequestException("Station has no charging point type configured"));
    }

    private PointType parsePointTypeOrNull(String typePreference) {
        String normalized = normalizeText(typePreference);
        if (normalized == null) {
            return null;
        }
        try {
            return PointType.valueOf(normalized.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Unsupported charging point type: " + typePreference);
        }
    }

    private ChargingPoint autoAssignPoint(Long stationId, String typePreference,
                                           LocalDateTime startTime, LocalDateTime endTime) {
        LocalDateTime storedStartTime = AppClock.toStoredScheduleTime(startTime);
        LocalDateTime storedEndTime = AppClock.toStoredScheduleTime(endTime);
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
            List<Booking> overlapping = bookingRepository.findOverlappingBookings(cp.getId(), storedStartTime, storedEndTime);
            if (overlapping.isEmpty()) {
                return cp;
            }
        }
        throw new ConflictException("No available charging points for the requested time slot");
    }

    private void validateOperatingHours(Station station, LocalDateTime start, LocalDateTime end) {
        StationOperatingHoursPolicy.validate(station, start, end);
    }

    private String generateReferenceId() {
        return "BK-" + UUID.randomUUID().toString().replace("-", "")
                .substring(0, 16).toUpperCase();
    }

    private String requestFingerprint(BookingRequest request) {
        String value = java.util.Arrays.asList(request.getStationId(), request.getChargingPointId(),
                request.getPointTypePreference(), request.getStartTime(), request.getDurationMinutes(),
                request.getDynamicEta(), request.getOriginLatitude(), request.getOriginLongitude(),
                request.getChargingPreference(), request.getRequestedEnergyKwh()).toString();
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
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
                .gridRegion(ChargingImpactService.regionFor(station))
                .chargingPointId(chargingPoint != null ? chargingPoint.getId() : b.getChargingPointId())
                .chargingPointIdentifier(chargingPoint != null ? chargingPoint.getIdentifier() : null)
                .pointType(chargingPoint != null && chargingPoint.getPointType() != null ? chargingPoint.getPointType().name() : b.getPointTypePreference())
                .vehicleId(bookingVehicle != null ? bookingVehicle.getId() : null)
                .vehicleNickname(vehicleNickname)
                .vehicleMake(vehicleMake)
                .vehicleModel(vehicleModel)
                .vehicleRegistration(vehicleRegistration)
                .startTime(AppClock.fromStoredScheduleTime(b.getStartTime()))
                .endTime(AppClock.fromStoredScheduleTime(b.getEndTime()))
                .reservedUntil(AppClock.fromStoredScheduleTime(b.getReservedUntil()))
                .holdExpiresAt(AppClock.fromStoredScheduleTime(b.getHoldExpiresAt()))
                .etaLiveTraffic(b.getEtaLiveTraffic())
                .waitSeconds(b.getPredictedArrivalAt() != null ? Math.max(0,
                        Duration.between(b.getPredictedArrivalAt(), b.getStartTime()).getSeconds()) : null)
                .requestedDurationMinutes(b.getRequestedDurationMinutes())
                .originLatitude(b.getOriginLatitude())
                .originLongitude(b.getOriginLongitude())
                .lastKnownLatitude(b.getLastKnownLatitude())
                .lastKnownLongitude(b.getLastKnownLongitude())
                .lastLocationPingAt(b.getLastLocationPingAt())
                .predictedArrivalAt(AppClock.fromStoredScheduleTime(b.getPredictedArrivalAt()))
                .gracePeriodEndTime(AppClock.fromStoredScheduleTime(b.getGracePeriodEndTime()))
                .etaSeconds(b.getEtaSeconds())
                .lastDistanceMeters(b.getLastDistanceMeters())
                .proximityLocked(Boolean.TRUE.equals(b.getProximityLocked()))
                .assignedChargingPointId(b.getAssignedChargingPointId())
                .virtualSpot(Boolean.TRUE.equals(b.getVirtualSpot()))
                .lockedRatePerUnit(b.getLockedRatePerUnit())
                .lockedRateType(b.getLockedRateType())
                .chargingPreference(b.getChargingPreference())
                .requestedEnergyKwh(b.getRequestedEnergyKwh())
                .expectedRenewableSharePercent(b.getExpectedRenewableSharePercent())
                .expectedCarbonKg(b.getExpectedCarbonKg())
                .estimatedCarbonSavedKg(b.getEstimatedCarbonSavedKg())
                .greenScore(b.getGreenScore())
                .energyDataMode(b.getEnergyDataMode())
                .energySource(b.getEnergySource())
                .energyQuality(b.getEnergyQuality())
                .energyCapturedAt(b.getEnergyCapturedAt())
                .status(b.getStatus() != null ? b.getStatus().name() : null)
                .cancellationReason(b.getCancellationReason())
                .rescheduleRequestStatus((b.getRescheduleRequestStatus() != null ? b.getRescheduleRequestStatus() : RescheduleRequestStatus.NONE).name())
                .rescheduleRequestedStartTime(AppClock.fromStoredScheduleTime(b.getRescheduleRequestedStartTime()))
                .rescheduleRequestedEndTime(AppClock.fromStoredScheduleTime(b.getRescheduleRequestedEndTime()))
                .rescheduleRequestReason(b.getRescheduleRequestReason())
                .rescheduleRequestedAt(b.getRescheduleRequestedAt())
                .rescheduleReviewedAt(b.getRescheduleReviewedAt())
                .rescheduleReviewedBy(b.getRescheduleReviewedBy())
                .createdAt(b.getCreatedAt())
                .updatedAt(b.getUpdatedAt())
                .build();
    }

    private ChargingImpactService.ChargingImpact resolveChargingImpact(BookingRequest request, Station station,
                                                                        LocalDateTime start, LocalDateTime end,
                                                                        ChargingPoint point) {
        if (request.getRequestedEnergyKwh() == null || request.getChargingPreference() == null
                || request.getChargingPreference().isBlank() || chargingImpactService == null) {
            return null;
        }
        BigDecimal maximumEnergy = BigDecimal.valueOf(point != null && point.getMaxPowerKw() != null
                        ? point.getMaxPowerKw() : 1)
                .multiply(BigDecimal.valueOf(request.getDurationMinutes()))
                .divide(BigDecimal.valueOf(60), 2, java.math.RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(0.92));
        if (request.getRequestedEnergyKwh().compareTo(maximumEnergy.add(BigDecimal.valueOf(0.01))) > 0) {
            throw new BadRequestException("Requested energy exceeds what this connector can deliver in the booking window");
        }
        try {
            return chargingImpactService.snapshot(station, start, end, request.getRequestedEnergyKwh(),
                    request.getChargingPreference().trim().toUpperCase());
        } catch (RuntimeException unavailable) {
            log.warn("Could not attach renewable snapshot to booking at station {}", station.getId());
            return null;
        }
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
        if (booking.getGracePeriodEndTime() != null) {
            throw new BadRequestException("Arrival bookings update from your location. Cancel this booking to choose a scheduled time.");
        }
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

        if (requestedStartTime.equals(AppClock.fromStoredScheduleTime(booking.getStartTime()))
                && requestedEndTime.equals(AppClock.fromStoredScheduleTime(booking.getEndTime()))) {
            throw new BadRequestException("Please select a different slot for reschedule");
        }

        LocalDateTime storedRequestedStartTime = AppClock.toStoredScheduleTime(requestedStartTime);
        LocalDateTime storedRequestedEndTime = AppClock.toStoredScheduleTime(requestedEndTime);
        List<Booking> overlapping = bookingRepository.findOverlappingBookingsExcluding(
                booking.getChargingPoint().getId(), storedRequestedStartTime, storedRequestedEndTime, booking.getId());
        if (!overlapping.isEmpty()) {
            throw new ConflictException("Requested time slot conflicts with existing bookings");
        }
    }

    private int getBookingDurationMinutes(Booking booking) {
        long duration = Duration.between(
                AppClock.fromStoredScheduleTime(booking.getStartTime()),
                AppClock.fromStoredScheduleTime(booking.getEndTime())).toMinutes();
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
                log.warn("Failed to notify admin {} for booking workflow; type={}",
                        admin.getId(), ex.getClass().getName());
            }
        }
    }

    private boolean isPointBlockedForBooking(PointStatus status) {
        return status == PointStatus.OUT_OF_SERVICE || status == PointStatus.UNAVAILABLE
                || status == PointStatus.RESERVED || status == PointStatus.CHARGING;
    }

    private Booking hydrate(Booking booking) {
        return referenceResolver != null ? referenceResolver.hydrate(booking) : booking;
    }

    private ChargingPoint hydrate(ChargingPoint chargingPoint) {
        return referenceResolver != null ? referenceResolver.hydrate(chargingPoint) : chargingPoint;
    }

    private boolean isBookingOwnedBy(Booking booking, String actorEmail) {
        if (booking == null || actorEmail == null) {
            return false;
        }
        Long bookingCustomerId = booking.getCustomerId() != null
                ? booking.getCustomerId()
                : booking.getCustomer() != null ? booking.getCustomer().getId() : null;
        if (bookingCustomerId == null) {
            return false;
        }
        return userRepository.findByEmail(actorEmail)
                .map(User::getId)
                .map(bookingCustomerId::equals)
                .orElse(false);
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
