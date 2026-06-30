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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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

    private static final DateTimeFormatter SESSION_START_TIME_FORMAT = DateTimeFormatter.ofPattern("hh:mm a");

    private final ChargingSessionRepository sessionRepository;
    private final BookingRepository bookingRepository;
    private final ChargingPointRepository cpRepository;
    private final UserRepository userRepository;
    private final BillRepository billRepository;
    private final PricingSnapshotService pricingSnapshotService;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final EntityReferenceResolver referenceResolver;
    private final WalletService walletService;
    private final ChargerCommandService chargerCommandService;
    private final InvoiceEmailService invoiceEmailService;
    private final TaskScheduler taskScheduler;
    private final TransactionTemplate transactionTemplate;
    private final Map<Long, ScheduledFuture<?>> completionTasks = new ConcurrentHashMap<>();
    private final Object completionLock = new Object();

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

        booking = prepareDynamicBookingForSessionStart(booking);
        validateBookingStartWindow(booking);

        if (booking.getChargingPoint() == null) {
            throw new BadRequestException("A connector will be assigned when you are within 1 mile of the station.");
        }

        if (booking.getChargingPoint().getStatus() == PointStatus.OUT_OF_SERVICE
                || booking.getChargingPoint().getStatus() == PointStatus.UNAVAILABLE) {
            throw new BadRequestException("Charging point is currently unavailable. Please wait for admin to restore it.");
        }

        ensureLockedPricing(booking, "Session started for booking " + booking.getReferenceId() + ".");
        walletService.ensureReadyForSessionStart(booking.getCustomer());

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
                .walletDebitedAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .build();

        session = sessionRepository.save(session);
        scheduleExactCompletion(session);
        auditService.log("START_SESSION", "SESSION", session.getId(), customerEmail,
                "Session started for booking " + booking.getReferenceId());
        return toResponse(session);
    }

    public SessionResponse endSession(Long sessionId, String performedBy) {
        synchronized (completionLock) {
            return runWithTransientCompletionRetry(() -> transactionTemplate.execute(status -> {
                ChargingSession session = sessionRepository.findById(sessionId)
                        .orElseThrow(() -> new ResourceNotFoundException("Session not found"));
                session = referenceResolver.hydrate(session);

                if (session.getStatus() != SessionStatus.IN_PROGRESS) {
                    if (session.getStatus() == SessionStatus.COMPLETED) {
                        return toResponse(session);
                    }
                    throw new BadRequestException("Session is not in progress");
                }

                return completeSession(session, performedBy, false);
            }));
        }
    }

    private SessionResponse completeSession(ChargingSession session, String performedBy, boolean automatic) {
        session = referenceResolver.hydrate(session);
        LocalDateTime now = AppClock.now();

        if (automatic) {
            // Auto-completed sessions must stop at the absolute booking end time.
            LocalDateTime scheduledEnd = resolveScheduledSessionEndTime(session);
            session.setEndTime(scheduledEnd != null ? scheduledEnd : now);
        } else {
            session.setEndTime(resolveAllowedSessionEndTime(session, now));
        }
        session.setStatus(SessionStatus.COMPLETED);

        double powerKw = session.getChargingPoint().getMaxPowerKw();
        long durationSeconds = resolveBillingDurationSeconds(session);
        if (durationSeconds <= 0) {
            durationSeconds = Math.max(1, resolveBillingDurationMinutes(session)) * 60;
        }
        double theoreticalEnergyKwh = (powerKw * durationSeconds) / 3600.0;
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

        // Generate bill
        generateBill(session);

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
    public void autoCompleteExpiredSessions() {
        LocalDateTime now = AppClock.now();
        List<ChargingSession> activeSessions = sessionRepository.findByStatus(SessionStatus.IN_PROGRESS);

        for (ChargingSession session : activeSessions) {
            ChargingSession hydrated = referenceResolver.hydrate(session);
            if (!isSessionExpiredAt(hydrated, now)) {
                continue;
            }
            autoCompleteSessionById(hydrated.getId());
        }
    }

    @Scheduled(initialDelayString = "${app.wallet.monitor-initial-delay-ms:2000}",
            fixedRateString = "${app.wallet.monitor-check-ms:3000}")
    public void monitorActiveWalletBalances() {
        List<ChargingSession> activeSessions = sessionRepository.findByStatus(SessionStatus.IN_PROGRESS);
        LocalDateTime now = AppClock.now();
        for (ChargingSession session : activeSessions) {
            try {
                ChargingSession hydrated = referenceResolver.hydrate(session);
                if (hydrated.getStatus() != SessionStatus.IN_PROGRESS || isSessionExpiredAt(hydrated, now)) {
                    continue;
                }
                monitorWalletForSession(hydrated);
            } catch (Exception ex) {
                log.warn("Failed to monitor wallet for session {}", session.getId(), ex);
            }
        }
    }

    private void validateBookingStartWindow(Booking booking) {
        LocalDateTime now = AppClock.now();
        LocalDateTime startTime = AppClock.fromStoredScheduleTime(booking.getStartTime());
        LocalDateTime endTime = AppClock.fromStoredScheduleTime(booking.getEndTime());

        if (startTime != null && now.isBefore(startTime)) {
            throw new BadRequestException("This session can only be started at your booked time ("
                    + startTime.format(SESSION_START_TIME_FORMAT) + ").");
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

        releaseReservedPointIfNeeded(booking);
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

    private Booking prepareDynamicBookingForSessionStart(Booking booking) {
        if (booking.getGracePeriodEndTime() == null) {
            return booking;
        }

        LocalDateTime now = AppClock.now().withNano(0);
        LocalDateTime graceEnd = AppClock.fromStoredScheduleTime(booking.getGracePeriodEndTime());
        if (graceEnd != null && now.isAfter(graceEnd)) {
            cancelMissedBooking(booking);
            throw new BadRequestException("This booking grace period has expired and the session can no longer be started.");
        }

        if (!Boolean.TRUE.equals(booking.getProximityLocked()) || booking.getChargingPoint() == null) {
            throw new BadRequestException("A connector will be assigned when you are within 1 mile of the station.");
        }

        int durationMinutes = booking.getRequestedDurationMinutes() != null
                ? Math.max(1, Math.min(60, booking.getRequestedDurationMinutes()))
                : Math.max(1, resolveBillingDurationMinutesForBooking(booking));
        booking.setStartTime(AppClock.toStoredScheduleTime(now));
        booking.setEndTime(AppClock.toStoredScheduleTime(now.plusMinutes(durationMinutes)));
        booking.setVirtualSpot(false);
        return bookingRepository.save(booking);
    }

    private int resolveBillingDurationMinutesForBooking(Booking booking) {
        LocalDateTime startTime = AppClock.fromStoredScheduleTime(booking.getStartTime());
        LocalDateTime endTime = AppClock.fromStoredScheduleTime(booking.getEndTime());
        if (startTime == null || endTime == null || !endTime.isAfter(startTime)) {
            return 60;
        }
        return (int) Math.max(1, java.time.Duration.between(startTime, endTime).toMinutes());
    }

    private void releaseReservedPointIfNeeded(Booking booking) {
        ChargingPoint point = booking.getChargingPoint();
        if (point == null && booking.getAssignedChargingPointId() != null) {
            point = cpRepository.findById(booking.getAssignedChargingPointId()).orElse(null);
        }
        if (point == null || point.getStatus() != PointStatus.RESERVED) {
            return;
        }
        point.setStatus(PointStatus.AVAILABLE);
        cpRepository.save(point);
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
        Booking booking = session != null ? session.getBooking() : null;
        if (booking == null) {
            return null;
        }

        LocalDateTime bookingEndTime = AppClock.fromStoredScheduleTime(booking.getEndTime());
        return bookingEndTime != null ? bookingEndTime.withNano(0) : null;
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
                    autoCompleteSessionById(hydrated.getId());
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

    private void generateBill(ChargingSession session) {
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

        long durationSeconds = resolveBillingDurationSeconds(session);
        long durationMinutes = resolveBillingDurationMinutes(session);
        if (durationSeconds <= 0 && durationMinutes > 0) {
            durationSeconds = durationMinutes * 60;
        }

        if (rate == null || rateType == null || rateType.isBlank()) {
            rate = defaultRatePerKwh;
            rateType = PricingModel.PER_KWH.name();
        }
        rateType = PricingModel.PER_KWH.name();
        totalAmount = energyKwh.multiply(rate);

        totalAmount = totalAmount.setScale(2, RoundingMode.HALF_UP);
        if (totalAmount.compareTo(BigDecimal.ONE) < 0) {
            totalAmount = BigDecimal.ONE.setScale(2, RoundingMode.HALF_UP);
        }

        String invoiceNumber = "INV-" + System.currentTimeMillis();
        WalletService.WalletSettlementResult walletSettlement =
                walletService.settleCompletedSession(session, totalAmount, invoiceNumber);
        session.setWalletDebitedAmount(walletSettlement.walletDebitedAmount());
        session.setWalletBalanceAfterLastDebit(walletSettlement.balanceAfter());
        session.setWalletLastCheckedAt(AppClock.now());
        sessionRepository.save(session);

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
                .paymentStatus(walletSettlement.paid() ? PaymentStatus.PAID : PaymentStatus.UNPAID)
                .paidAt(walletSettlement.paid() ? AppClock.now() : null)
                .build();

        bill = billRepository.save(bill);
        if (walletSettlement.paid()) {
            schedulePaidInvoiceEmail(bill.getId());
        }
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
                .connectorType(chargingPoint != null ? chargingPoint.getConnectorType() : null)
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
                .walletDebitedAmount(s.getWalletDebitedAmount())
                .walletBalanceAfterLastDebit(s.getWalletBalanceAfterLastDebit())
                .walletLastCheckedAt(s.getWalletLastCheckedAt())
                .autoStoppedForWallet(s.getAutoStoppedForWallet())
                .walletStopReason(s.getWalletStopReason())
                .status(s.getStatus() != null ? s.getStatus().name() : null)
                .build();
    }

    private void monitorWalletForSession(ChargingSession session) {
        BigDecimal estimatedCost = estimateLiveCost(session);
        WalletService.WalletSessionMonitorResult result = walletService.applyLiveSessionDebit(session, estimatedCost);
        session.setWalletDebitedAmount(result.walletDebitedAmount());
        session.setWalletBalanceAfterLastDebit(result.balanceAfter());
        session.setWalletLastCheckedAt(AppClock.now());
        sessionRepository.save(session);
        if (result.shouldStop()) {
            stopSessionForWalletCutoff(session.getId(), result.reason());
        }
    }

    private BigDecimal estimateLiveCost(ChargingSession session) {
        session = referenceResolver.hydrate(session);
        Booking booking = session.getBooking();
        ChargingPoint chargingPoint = session.getChargingPoint();
        if (booking == null || chargingPoint == null || session.getStartTime() == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal rate = booking.getLockedRatePerUnit();
        String rateType = booking.getLockedRateType();
        if (rate == null || rateType == null || rateType.isBlank()) {
            rate = defaultRatePerKwh;
        }
        LocalDateTime scheduledEndTime = resolveScheduledSessionEndTime(session);
        long elapsedSeconds = resolveElapsedSeconds(session, scheduledEndTime);
        BigDecimal elapsedEnergyKwh = BigDecimal.valueOf(chargingPoint.getMaxPowerKw())
                .multiply(BigDecimal.valueOf(normalizedEfficiency()))
                .multiply(BigDecimal.valueOf(elapsedSeconds))
                .divide(BigDecimal.valueOf(3600), 6, RoundingMode.HALF_UP);
        return elapsedEnergyKwh.multiply(rate).setScale(2, RoundingMode.HALF_UP);
    }

    private void stopSessionForWalletCutoff(Long sessionId, String reason) {
        if (sessionId == null) {
            return;
        }
        synchronized (completionLock) {
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
                    hydrated.setAutoStoppedForWallet(true);
                    hydrated.setWalletStopReason(reason);
                    chargerCommandService.stopTransaction(hydrated, reason);
                    completeSession(hydrated, "system-wallet", false);
                    notificationService.send(hydrated.getCustomer().getId(), "Charging stopped",
                            "Your wallet ran out of balance and Auto-Top-Up could not continue the session.");
                });
            } catch (Exception ex) {
                log.warn("Failed to stop session {} after wallet cut-off", sessionId, ex);
            }
        }
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
        if (session.getStartTime() != null && session.getEndTime() != null) {
            long actualSeconds = Duration.between(session.getStartTime(), session.getEndTime()).toSeconds();
            actualSeconds = Math.max(0, actualSeconds);
            return bookedSeconds > 0 ? Math.min(actualSeconds, bookedSeconds) : actualSeconds;
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

        var triggerAt = scheduledEndTime.atZone(AppClock.BUSINESS_ZONE).toInstant();
        ScheduledFuture<?> task = taskScheduler.schedule(() -> autoCompleteSessionById(sessionId), triggerAt);
        if (task != null) {
            completionTasks.put(sessionId, task);
        }
    }

    private void autoCompleteSessionById(Long sessionId) {
        if (sessionId == null) {
            return;
        }

        synchronized (completionLock) {
            completionTasks.remove(sessionId);
            try {
                runWithTransientCompletionRetry(() -> {
                    transactionTemplate.executeWithoutResult(status -> completeSessionIfExpired(sessionId));
                    return null;
                });
            } catch (Exception ex) {
                log.warn("Failed to auto-complete session {} at its scheduled end time", sessionId, ex);
            }
        }
    }

    private void completeSessionIfExpired(Long sessionId) {
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
    }

    private <T> T runWithTransientCompletionRetry(Supplier<T> action) {
        RuntimeException lastException = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                return action.get();
            } catch (RuntimeException ex) {
                if (!isTransientWriteConflict(ex) || attempt == 3) {
                    throw ex;
                }
                lastException = ex;
                sleepBeforeCompletionRetry(attempt);
            }
        }
        throw lastException != null
                ? lastException
                : new IllegalStateException("Session completion retry failed");
    }

    private boolean isTransientWriteConflict(Throwable exception) {
        Throwable current = exception;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && (message.contains("WriteConflict")
                    || message.contains("TransientTransactionError")
                    || message.contains("error 112"))) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private void sleepBeforeCompletionRetry(int attempt) {
        try {
            Thread.sleep(50L * attempt);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Session completion retry was interrupted", interrupted);
        }
    }

    private void schedulePaidInvoiceEmail(Long billId) {
        if (billId == null) {
            return;
        }
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    invoiceEmailService.sendPaidInvoice(billId);
                }
            });
            return;
        }
        invoiceEmailService.sendPaidInvoice(billId);
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
