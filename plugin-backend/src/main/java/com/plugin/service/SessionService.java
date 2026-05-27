package com.plugin.service;

import com.plugin.config.AppClock;

import com.plugin.dto.response.SessionResponse;
import com.plugin.entity.*;
import com.plugin.enums.*;
import com.plugin.exception.*;
import com.plugin.repository.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
@Slf4j
public class SessionService {

    private static final long SESSION_START_GRACE_SECONDS = 60;

    private final ChargingSessionRepository sessionRepository;
    private final BookingRepository bookingRepository;
    private final ChargingPointRepository cpRepository;
    private final UserRepository userRepository;
    private final BillRepository billRepository;
    private final PricingSnapshotService pricingSnapshotService;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final EntityReferenceResolver referenceResolver;
    private final TaskScheduler taskScheduler;
    private final TransactionTemplate transactionTemplate;
    private final Map<Long, ScheduledFuture<?>> completionTasks = new ConcurrentHashMap<>();

    @Value("${app.billing.default-rate-per-kwh:15}")
    private BigDecimal defaultRatePerKwh;

    @Value("${app.billing.efficiency-factor:0.92}")
    private double billingEfficiencyFactor;

    @PostConstruct
    public void scheduleActiveSessionCompletions() {
        List<ChargingSession> activeSessions = sessionRepository.findByStatus(SessionStatus.IN_PROGRESS);
        activeSessions.forEach(this::scheduleExactCompletion);
    }

    @Transactional
    public SessionResponse startSession(Long bookingId, String customerEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        booking = referenceResolver.hydrate(booking);

        if (!booking.getCustomer().getEmail().equals(customerEmail)) {
            throw new BadRequestException("You can only start sessions for your own bookings");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED
                || booking.getStatus() == BookingStatus.NO_SHOW) {
            throw new BadRequestException("Cannot start session for " + booking.getStatus() + " booking");
        }
        if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.MODIFIED) {
            throw new BadRequestException("Cannot start session for " + booking.getStatus() + " booking");
        }

        if (sessionRepository.findByBookingId(bookingId).isPresent()) {
            throw new ConflictException("Session already exists for this booking");
        }

        validateBookingStartWindow(booking);

        if (booking.getChargingPoint().getStatus() == PointStatus.OUT_OF_SERVICE
                || booking.getChargingPoint().getStatus() == PointStatus.UNAVAILABLE) {
            throw new BadRequestException("Charging point is currently unavailable. Please wait for admin to restore it.");
        }

        ensureLockedPricing(booking, "Session started for booking " + booking.getReferenceId() + ".");

        ChargingPoint cp = booking.getChargingPoint();
        cp.setStatus(PointStatus.CHARGING);
        cpRepository.save(cp);

        ChargingSession session = ChargingSession.builder()
                .booking(booking)
                .chargingPoint(cp)
                .customer(booking.getCustomer())
                .startTime(AppClock.now().withNano(0))
                .status(SessionStatus.IN_PROGRESS)
                .energyDeliveredKwh(BigDecimal.ZERO)
                .build();

        session = sessionRepository.save(session);
        scheduleExactCompletion(session);
        auditService.log("START_SESSION", "SESSION", session.getId(), customerEmail,
                "Session started for booking " + booking.getReferenceId());
        return toResponse(session);
    }

    @Transactional
    public SessionResponse endSession(Long sessionId, String performedBy) {
        ChargingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));
        session = referenceResolver.hydrate(session);

        if (session.getStatus() != SessionStatus.IN_PROGRESS) {
            throw new BadRequestException("Session is not in progress");
        }

        return completeSession(session, performedBy, false);
    }

    private SessionResponse completeSession(ChargingSession session, String performedBy, boolean automatic) {
        session = referenceResolver.hydrate(session);
        LocalDateTime now = AppClock.now();

        if (automatic) {
            // For auto-completed sessions, use the exact scheduled end time
            // so billing duration matches the booked duration perfectly.
            LocalDateTime scheduledEnd = resolveScheduledSessionEndTime(session);
            session.setEndTime(scheduledEnd != null ? scheduledEnd : now);
        } else {
            session.setEndTime(resolveAllowedSessionEndTime(session, now));
        }
        session.setStatus(SessionStatus.COMPLETED);

        // Simulate energy delivered for the billable slot, not late-click seconds.
        long durationMinutes = automatic
                ? Math.max(1, (resolveBookedDurationSeconds(session) + 59) / 60)
                : resolveBillingDurationMinutes(session);

        double powerKw = session.getChargingPoint().getMaxPowerKw();
        double theoreticalEnergyKwh = (powerKw * durationMinutes) / 60.0;
        double energyKwh = theoreticalEnergyKwh * normalizedEfficiency();
        session.setEnergyDeliveredKwh(BigDecimal.valueOf(energyKwh).setScale(2, RoundingMode.HALF_UP));

        session = sessionRepository.save(session);
        cancelExactCompletion(session.getId());

        // Mark charging point available
        ChargingPoint cp = session.getChargingPoint();
        cp.setStatus(PointStatus.AVAILABLE);
        cpRepository.save(cp);

        // Mark booking completed
        Booking booking = session.getBooking();
        booking.setStatus(BookingStatus.COMPLETED);
        bookingRepository.save(booking);

        // Generate bill — pass automatic flag so it uses exact booked duration
        generateBill(session, automatic);

        auditService.log(automatic ? "AUTO_END_SESSION" : "END_SESSION", "SESSION", session.getId(), performedBy,
                (automatic ? "Session auto-ended at the selected booking end time. " : "Session ended. ") +
                        "Energy: " + session.getEnergyDeliveredKwh() + " kWh");

        notificationService.send(session.getCustomer().getId(), "Charging Complete",
                automatic
                        ? "Your selected charging time has ended. Energy delivered: " + session.getEnergyDeliveredKwh() + " kWh"
                        : "Your charging session is complete. Energy delivered: " + session.getEnergyDeliveredKwh() + " kWh");

        return toResponse(session);
    }

    @Scheduled(initialDelayString = "${app.sessions.auto-complete-initial-delay-ms:1000}",
            fixedRateString = "${app.sessions.auto-complete-check-ms:1000}")
    @Transactional
    public void autoCompleteExpiredSessions() {
        LocalDateTime now = AppClock.now();
        List<ChargingSession> activeSessions = sessionRepository.findByStatus(SessionStatus.IN_PROGRESS);

        for (ChargingSession session : activeSessions) {
            ChargingSession hydrated = referenceResolver.hydrate(session);
            if (!isSessionExpiredAt(hydrated, now)) {
                continue;
            }
            try {
                completeSession(hydrated, "system", true);
            } catch (Exception ex) {
                log.warn("Failed to auto-complete expired session {}", hydrated.getId(), ex);
            }
        }
    }

    private void validateBookingStartWindow(Booking booking) {
        LocalDateTime now = AppClock.now();
        LocalDateTime startTime = AppClock.fromStoredScheduleTime(booking.getStartTime());
        LocalDateTime endTime = AppClock.fromStoredScheduleTime(booking.getEndTime());

        if (startTime != null && now.plusSeconds(SESSION_START_GRACE_SECONDS).isBefore(startTime)) {
            throw new BadRequestException("Session can only be started at the selected booking time.");
        }

        if (endTime != null && !now.isBefore(endTime)) {
            cancelMissedBooking(booking);
            throw new BadRequestException("This booking time has expired and the session can no longer be started.");
        }
    }

    private void cancelMissedBooking(Booking booking) {
        if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.MODIFIED) {
            return;
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason("Booking expired because the reserved charging window was missed.");
        bookingRepository.save(booking);

        Long customerId = booking.getCustomer() != null ? booking.getCustomer().getId() : booking.getCustomerId();
        if (customerId != null) {
            String stationName = booking.getChargingPoint() != null && booking.getChargingPoint().getStation() != null
                    ? booking.getChargingPoint().getStation().getName()
                    : "your station";
            try {
                notificationService.send(customerId, "Booking Cancelled",
                        "Your booking " + booking.getReferenceId() + " at " + stationName +
                                " was cancelled because the selected charging time was missed.");
            } catch (Exception ex) {
                log.warn("Failed to send missed booking notification for booking {}", booking.getId(), ex);
            }
        }

        try {
            auditService.log("EXPIRE_BOOKING", "BOOKING", booking.getId(), "system",
                    "Booking expired automatically: " + booking.getReferenceId());
        } catch (Exception ex) {
            log.warn("Failed to write missed booking audit log for booking {}", booking.getId(), ex);
        }
    }

    private LocalDateTime resolveAllowedSessionEndTime(ChargingSession session, LocalDateTime now) {
        LocalDateTime scheduledEndTime = resolveScheduledSessionEndTime(session);
        if (scheduledEndTime != null && now.isAfter(scheduledEndTime)) {
            return scheduledEndTime;
        }
        return now;
    }

    private boolean isSessionExpiredAt(ChargingSession session, LocalDateTime now) {
        LocalDateTime scheduledEndTime = resolveScheduledSessionEndTime(session);
        return scheduledEndTime != null && !now.isBefore(scheduledEndTime);
    }

    private LocalDateTime resolveScheduledSessionEndTime(ChargingSession session) {
        if (session == null || session.getStartTime() == null) {
            return null;
        }

        long bookedSeconds = resolveBookedDurationSeconds(session);
        if (bookedSeconds <= 0) {
            return null;
        }
        // Session startTime is already truncated to whole seconds at creation.
        return session.getStartTime().withNano(0).plusSeconds(bookedSeconds);
    }

    private LocalDateTime resolveScheduledBookingStartTime(ChargingSession session) {
        Booking booking = session != null ? session.getBooking() : null;
        return booking != null ? AppClock.fromStoredScheduleTime(booking.getStartTime()) : null;
    }

    public Page<SessionResponse> getMySessions(String email, Pageable pageable) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return withReferenceCache(() -> toSessionResponsePage(
                sessionRepository.findByCustomerIdOrderByStartTimeDesc(customer.getId(), pageable), pageable));
    }

    @Transactional
    public List<SessionResponse> getMyActiveSessions(String email) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return withReferenceCache(() -> {
            List<ChargingSession> sessions = sessionRepository.findByCustomerIdAndStatus(customer.getId(), SessionStatus.IN_PROGRESS);
            referenceResolver.preloadForSessions(sessions);
            LocalDateTime now = AppClock.now();
            List<ChargingSession> active = new ArrayList<>();
            for (ChargingSession session : sessions) {
                ChargingSession hydrated = referenceResolver.hydrate(session);
                if (isSessionExpiredAt(hydrated, now)) {
                    completeSession(hydrated, "system", true);
                } else {
                    active.add(hydrated);
                }
            }
            return active.stream().map(this::toResponse).toList();
        });
    }

    public Page<SessionResponse> getAllSessions(Pageable pageable) {
        return withReferenceCache(() -> toSessionResponsePage(
                sessionRepository.findAllByOrderByCreatedAtDesc(pageable), pageable));
    }

    public SessionResponse getSessionById(Long id) {
        return withReferenceCache(() ->
                toResponse(sessionRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Session not found"))));
    }

    private void generateBill(ChargingSession session, boolean autoCompleted) {
        session = referenceResolver.hydrate(session);
        if (session.getId() != null && billRepository.existsBySessionId(session.getId())) {
            return;
        }
        Booking booking = session.getBooking();
        ensureLockedPricing(booking, "Session " + session.getId() + " ended.");
        ChargingPoint cp = session.getChargingPoint();

        BigDecimal totalAmount;
        String rateType = booking.getLockedRateType();
        BigDecimal rate = booking.getLockedRatePerUnit();
        BigDecimal energyKwh = session.getEnergyDeliveredKwh();

        // When session auto-completed at its scheduled end, use the exact
        // booked duration so billing matches what the user selected (e.g.
        // 1 min = exactly 60 seconds, never 57 or 63).
        long bookedSeconds = resolveBookedDurationSeconds(session);
        long durationSeconds;
        long durationMinutes;

        if (autoCompleted && bookedSeconds > 0) {
            durationSeconds = bookedSeconds;
            durationMinutes = Math.max(1, (bookedSeconds + 59) / 60);
        } else {
            durationSeconds = resolveBillingDurationSeconds(session);
            durationMinutes = resolveBillingDurationMinutes(session);
            if (durationSeconds <= 0 && durationMinutes > 0) {
                durationSeconds = durationMinutes * 60;
            }
        }

        if (rate == null || rateType == null || rateType.isBlank()) {
            rate = defaultRatePerKwh;
            rateType = PricingModel.PER_KWH.name();
        }
        rateType = PricingModel.PER_KWH.name();
        totalAmount = energyKwh.multiply(rate);

        totalAmount = totalAmount.setScale(2, RoundingMode.HALF_UP);

        String invoiceNumber = "INV-" + System.currentTimeMillis();

        Bill bill = Bill.builder()
                .invoiceNumber(invoiceNumber)
                .session(session)
                .customer(session.getCustomer())
                .station(cp.getStation())
                .energyKwh(energyKwh)
                .durationMinutes(durationMinutes)
                .durationSeconds(durationSeconds)
                .rateApplied(rate)
                .rateType(rateType)
                .totalAmount(totalAmount)
                .paymentStatus(PaymentStatus.UNPAID)
                .build();

        billRepository.save(bill);
    }

    private SessionResponse toResponse(ChargingSession s) {
        s = referenceResolver.hydrate(s);
        Booking booking = s.getBooking();
        ChargingPoint chargingPoint = s.getChargingPoint();
        User customer = s.getCustomer();
        LocalDateTime scheduledStartTime = resolveScheduledBookingStartTime(s);
        LocalDateTime scheduledEndTime = resolveScheduledSessionEndTime(s);
        long scheduledDurationSeconds = resolveBookedDurationSeconds(s);
        BigDecimal estimateRate = null;
        String estimateRateType = null;
        BigDecimal estimatedAmount = null;
        UserVehicle bookingVehicle = booking != null ? booking.getVehicle() : null;

        if (s.getStatus() == SessionStatus.IN_PROGRESS && booking != null && chargingPoint != null) {
            estimateRate = booking.getLockedRatePerUnit();
            estimateRateType = booking.getLockedRateType();
            if (estimateRate == null || estimateRateType == null || estimateRateType.isBlank()) {
                estimateRate = defaultRatePerKwh;
                estimateRateType = PricingModel.PER_KWH.name();
            }
            estimateRateType = PricingModel.PER_KWH.name();

            long elapsedSeconds = resolveElapsedSeconds(s, scheduledEndTime);
            BigDecimal elapsedEnergyKwh = BigDecimal.valueOf(chargingPoint.getMaxPowerKw())
                    .multiply(BigDecimal.valueOf(normalizedEfficiency()))
                    .multiply(BigDecimal.valueOf(elapsedSeconds))
                    .divide(BigDecimal.valueOf(3600), 6, RoundingMode.HALF_UP);
            estimatedAmount = elapsedEnergyKwh.multiply(estimateRate);
            estimatedAmount = estimatedAmount.setScale(2, RoundingMode.HALF_UP);
        }

        String vehicleMake = bookingVehicle != null ? bookingVehicle.getVehicleMake() : customer != null ? customer.getVehicleMake() : null;
        String vehicleModel = bookingVehicle != null ? bookingVehicle.getVehicleModel() : customer != null ? customer.getVehicleModel() : null;
        String vehicleNickname = bookingVehicle != null ? bookingVehicle.getVehicleNickname() : null;
        String vehicleRegistration = bookingVehicle != null
                ? bookingVehicle.getVehicleRegistration()
                : customer != null ? customer.getVehicleRegistration() : null;
        Long elapsedSeconds = null;
        Long remainingSeconds = null;
        if (s.getStartTime() != null && s.getStatus() == SessionStatus.IN_PROGRESS) {
            elapsedSeconds = resolveElapsedSeconds(s, scheduledEndTime);
            remainingSeconds = resolveRemainingSeconds(scheduledEndTime);
        }

        return SessionResponse.builder()
                .id(s.getId())
                .bookingId(booking != null ? booking.getId() : s.getBookingId())
                .bookingReference(booking != null ? booking.getReferenceId() : null)
                .chargingPointId(chargingPoint != null ? chargingPoint.getId() : s.getChargingPointId())
                .chargingPointIdentifier(chargingPoint != null ? chargingPoint.getIdentifier() : null)
                .chargingPointType(chargingPoint != null && chargingPoint.getPointType() != null ? chargingPoint.getPointType().name() : null)
                .chargingPointMaxPowerKw(chargingPoint != null ? chargingPoint.getMaxPowerKw() : null)
                .customerId(customer != null ? customer.getId() : s.getCustomerId())
                .customerName(customer != null ? customer.getFullName() : null)
                .stationName(chargingPoint != null && chargingPoint.getStation() != null ? chargingPoint.getStation().getName() : null)
                .vehicleId(bookingVehicle != null ? bookingVehicle.getId() : null)
                .vehicleNickname(vehicleNickname)
                .vehicleMake(vehicleMake)
                .vehicleModel(vehicleModel)
                .vehicleRegistration(vehicleRegistration)
                .startTime(s.getStartTime())
                .endTime(s.getEndTime())
                .scheduledStartTime(scheduledStartTime)
                .scheduledEndTime(scheduledEndTime)
                .elapsedSeconds(elapsedSeconds)
                .remainingSeconds(remainingSeconds)
                .scheduledDurationSeconds(scheduledDurationSeconds > 0 ? scheduledDurationSeconds : null)
                .energyDeliveredKwh(s.getEnergyDeliveredKwh())
                .estimateRate(estimateRate)
                .estimateRateType(estimateRateType)
                .estimatedAmount(estimatedAmount)
                .status(s.getStatus() != null ? s.getStatus().name() : null)
                .build();
    }

    private long resolveElapsedSeconds(ChargingSession session, LocalDateTime scheduledEndTime) {
        LocalDateTime effectiveNow = AppClock.now();
        if (scheduledEndTime != null && effectiveNow.isAfter(scheduledEndTime)) {
            effectiveNow = scheduledEndTime;
        }
        return Math.max(0, Duration.between(session.getStartTime(), effectiveNow).getSeconds());
    }

    private Long resolveRemainingSeconds(LocalDateTime scheduledEndTime) {
        if (scheduledEndTime == null) {
            return null;
        }
        return ceilPositiveSeconds(Duration.between(AppClock.now(), scheduledEndTime));
    }

    private long ceilPositiveSeconds(Duration duration) {
        if (duration == null || duration.isZero() || duration.isNegative()) {
            return 0;
        }
        return duration.getSeconds() + (duration.getNano() > 0 ? 1 : 0);
    }

    private long resolveBillingDurationMinutes(ChargingSession session) {
        long seconds = resolveBillingDurationSeconds(session);
        if (seconds <= 0) {
            return 1;
        }
        return Math.max(1, (seconds + 59) / 60);
    }

    private long resolveBillingDurationSeconds(ChargingSession session) {
        long bookedSeconds = resolveBookedDurationSeconds(session);
        LocalDateTime scheduledEndTime = resolveScheduledSessionEndTime(session);

        // If the session ran to its scheduled end (or within 2 seconds of it),
        // bill exactly the booked duration — no more, no less.
        if (bookedSeconds > 0
                && session.getEndTime() != null
                && scheduledEndTime != null) {
            long diffSeconds = Math.abs(Duration.between(session.getEndTime(), scheduledEndTime).getSeconds());
            if (diffSeconds <= 2) {
                return bookedSeconds;
            }
        }

        if (session.getStartTime() != null && session.getEndTime() != null) {
            long actualSeconds = Duration.between(session.getStartTime(), session.getEndTime()).toSeconds();
            return Math.max(0, actualSeconds);
        }

        return bookedSeconds;
    }

    private long resolveBookedDurationSeconds(ChargingSession session) {
        Booking booking = session != null ? session.getBooking() : null;
        if (booking == null) {
            return 0;
        }

        LocalDateTime bookingStartTime = AppClock.fromStoredScheduleTime(booking.getStartTime());
        LocalDateTime bookingEndTime = AppClock.fromStoredScheduleTime(booking.getEndTime());
        if (bookingStartTime == null || bookingEndTime == null || !bookingEndTime.isAfter(bookingStartTime)) {
            return 0;
        }

        return Duration.between(bookingStartTime, bookingEndTime).getSeconds();
    }

    private double normalizedEfficiency() {
        if (billingEfficiencyFactor < 0.0) return 0.0;
        if (billingEfficiencyFactor > 1.0) return 1.0;
        return billingEfficiencyFactor;
    }

    private void scheduleExactCompletion(ChargingSession session) {
        ChargingSession hydrated = referenceResolver.hydrate(session);
        if (hydrated == null || hydrated.getId() == null || hydrated.getStatus() != SessionStatus.IN_PROGRESS) {
            return;
        }

        LocalDateTime scheduledEndTime = resolveScheduledSessionEndTime(hydrated);
        if (scheduledEndTime == null) {
            return;
        }

        Long sessionId = hydrated.getId();
        cancelExactCompletion(sessionId);

        if (!scheduledEndTime.isAfter(AppClock.now())) {
            autoCompleteSessionById(sessionId);
            return;
        }

        // Schedule 200ms AFTER the end time to guarantee the scheduler never
        // fires a fraction of a second early (which would cause re-scheduling).
        var triggerAt = scheduledEndTime.atZone(AppClock.BUSINESS_ZONE).toInstant().plusMillis(200);
        ScheduledFuture<?> task = taskScheduler.schedule(() -> autoCompleteSessionById(sessionId), triggerAt);
        if (task != null) {
            completionTasks.put(sessionId, task);
        }
    }

    private void autoCompleteSessionById(Long sessionId) {
        if (sessionId == null) {
            return;
        }

        completionTasks.remove(sessionId);
        try {
            transactionTemplate.executeWithoutResult(status -> {
                ChargingSession session = sessionRepository.findById(sessionId).orElse(null);
                if (session == null) {
                    return;
                }

                ChargingSession hydrated = referenceResolver.hydrate(session);
                if (hydrated.getStatus() != SessionStatus.IN_PROGRESS) {
                    return;
                }

                if (!isSessionExpiredAt(hydrated, AppClock.now())) {
                    scheduleExactCompletion(hydrated);
                    return;
                }

                completeSession(hydrated, "system", true);
            });
        } catch (Exception ex) {
            log.warn("Failed to auto-complete session {} at its scheduled end time", sessionId, ex);
        }
    }

    private void cancelExactCompletion(Long sessionId) {
        if (sessionId == null) {
            return;
        }
        ScheduledFuture<?> existing = completionTasks.remove(sessionId);
        if (existing != null && !existing.isDone()) {
            existing.cancel(false);
        }
    }

    private Page<SessionResponse> toSessionResponsePage(Page<ChargingSession> page, Pageable pageable) {
        List<ChargingSession> sessions = page.getContent();
        referenceResolver.preloadForSessions(sessions);
        List<SessionResponse> content = sessions.stream().map(this::toResponse).toList();
        return new PageImpl<>(content, pageable, page.getTotalElements());
    }

    private <T> T withReferenceCache(Supplier<T> supplier) {
        return referenceResolver != null ? referenceResolver.withCache(supplier) : supplier.get();
    }

    private void ensureLockedPricing(Booking booking, String context) {
        boolean hasValidLockedRate = booking.getLockedRatePerUnit() != null
                && PricingModel.PER_KWH.name().equalsIgnoreCase(booking.getLockedRateType());
        if (hasValidLockedRate) {
            return;
        }

        PricingSnapshotService.PricingSnapshot snapshot = pricingSnapshotService.resolveFor(
                booking.getStation(),
                booking.getChargingPoint().getPointType()
        );
        booking.setLockedRatePerUnit(snapshot.ratePerUnit());
        booking.setLockedRateType(PricingModel.PER_KWH.name());
        bookingRepository.save(booking);

        if (snapshot.usedFallback()) {
            pricingSnapshotService.notifyAdminsMissingPricing(
                    booking.getStation(),
                    booking.getChargingPoint().getPointType(),
                    context
            );
        }
    }
}
