package com.plugin.service;

import com.plugin.dto.response.SessionResponse;
import com.plugin.entity.*;
import com.plugin.enums.*;
import com.plugin.exception.*;
import com.plugin.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final ChargingSessionRepository sessionRepository;
    private final BookingRepository bookingRepository;
    private final ChargingPointRepository cpRepository;
    private final UserRepository userRepository;
    private final BillRepository billRepository;
    private final PricingSnapshotService pricingSnapshotService;
    private final AuditService auditService;
    private final NotificationService notificationService;

    @Value("${app.billing.default-rate-per-kwh:15}")
    private BigDecimal defaultRatePerKwh;

    @Value("${app.billing.efficiency-factor:0.92}")
    private double billingEfficiencyFactor;

    @Transactional
    public SessionResponse startSession(Long bookingId, String customerEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getCustomer().getEmail().equals(customerEmail)) {
            throw new BadRequestException("You can only start sessions for your own bookings");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Cannot start session for " + booking.getStatus() + " booking");
        }

        if (sessionRepository.findByBookingId(bookingId).isPresent()) {
            throw new ConflictException("Session already exists for this booking");
        }

        ensureLockedPricing(booking, "Session started for booking " + booking.getReferenceId() + ".");

        ChargingPoint cp = booking.getChargingPoint();
        cp.setStatus(PointStatus.CHARGING);
        cpRepository.save(cp);

        ChargingSession session = ChargingSession.builder()
                .booking(booking)
                .chargingPoint(cp)
                .customer(booking.getCustomer())
                .startTime(LocalDateTime.now())
                .status(SessionStatus.IN_PROGRESS)
                .energyDeliveredKwh(BigDecimal.ZERO)
                .build();

        session = sessionRepository.save(session);
        auditService.log("START_SESSION", "SESSION", session.getId(), customerEmail,
                "Session started for booking " + booking.getReferenceId());
        return toResponse(session);
    }

    @Transactional
    public SessionResponse endSession(Long sessionId, String performedBy) {
        ChargingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        if (session.getStatus() != SessionStatus.IN_PROGRESS) {
            throw new BadRequestException("Session is not in progress");
        }

        session.setEndTime(LocalDateTime.now());
        session.setStatus(SessionStatus.COMPLETED);

        // Simulate energy delivered
        long durationMinutes = Duration.between(session.getStartTime(), session.getEndTime()).toMinutes();
        if (durationMinutes < 1) durationMinutes = 1;

        double powerKw = session.getChargingPoint().getMaxPowerKw();
        double theoreticalEnergyKwh = (powerKw * durationMinutes) / 60.0;
        double energyKwh = theoreticalEnergyKwh * normalizedEfficiency();
        session.setEnergyDeliveredKwh(BigDecimal.valueOf(energyKwh).setScale(2, RoundingMode.HALF_UP));

        session = sessionRepository.save(session);

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

        auditService.log("END_SESSION", "SESSION", session.getId(), performedBy,
                "Session ended. Energy: " + session.getEnergyDeliveredKwh() + " kWh");

        notificationService.send(session.getCustomer().getId(), "Charging Complete",
                "Your charging session is complete. Energy delivered: " +
                session.getEnergyDeliveredKwh() + " kWh");

        return toResponse(session);
    }

    public Page<SessionResponse> getMySessions(String email, Pageable pageable) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return sessionRepository.findByCustomerIdOrderByStartTimeDesc(customer.getId(), pageable)
                .map(this::toResponse);
    }

    public List<SessionResponse> getMyActiveSessions(String email) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return sessionRepository.findByCustomerIdAndStatus(customer.getId(), SessionStatus.IN_PROGRESS)
                .stream().map(this::toResponse).toList();
    }

    public Page<SessionResponse> getAllSessions(Pageable pageable) {
        return sessionRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::toResponse);
    }

    public SessionResponse getSessionById(Long id) {
        return toResponse(sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found")));
    }

    private void generateBill(ChargingSession session) {
        Booking booking = session.getBooking();
        ensureLockedPricing(booking, "Session " + session.getId() + " ended.");
        ChargingPoint cp = session.getChargingPoint();

        BigDecimal totalAmount;
        String rateType = booking.getLockedRateType();
        BigDecimal rate = booking.getLockedRatePerUnit();
        BigDecimal energyKwh = session.getEnergyDeliveredKwh();
        long durationMinutes = Duration.between(session.getStartTime(), session.getEndTime()).toMinutes();
        if (durationMinutes < 1) durationMinutes = 1;

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
                .rateApplied(rate)
                .rateType(rateType)
                .totalAmount(totalAmount)
                .paymentStatus(PaymentStatus.UNPAID)
                .build();

        billRepository.save(bill);
    }

    private SessionResponse toResponse(ChargingSession s) {
        BigDecimal estimateRate = null;
        String estimateRateType = null;
        BigDecimal estimatedAmount = null;
        UserVehicle bookingVehicle = s.getBooking().getVehicle();

        if (s.getStatus() == SessionStatus.IN_PROGRESS) {
            Booking booking = s.getBooking();
            estimateRate = booking.getLockedRatePerUnit();
            estimateRateType = booking.getLockedRateType();
            if (estimateRate == null || estimateRateType == null || estimateRateType.isBlank()) {
                estimateRate = defaultRatePerKwh;
                estimateRateType = PricingModel.PER_KWH.name();
            }
            estimateRateType = PricingModel.PER_KWH.name();

            long elapsedSeconds = Math.max(0, Duration.between(s.getStartTime(), LocalDateTime.now()).getSeconds());
            BigDecimal elapsedEnergyKwh = BigDecimal.valueOf(s.getChargingPoint().getMaxPowerKw())
                    .multiply(BigDecimal.valueOf(normalizedEfficiency()))
                    .multiply(BigDecimal.valueOf(elapsedSeconds))
                    .divide(BigDecimal.valueOf(3600), 6, RoundingMode.HALF_UP);
            estimatedAmount = elapsedEnergyKwh.multiply(estimateRate);
            estimatedAmount = estimatedAmount.setScale(2, RoundingMode.HALF_UP);
        }

        String vehicleMake = bookingVehicle != null ? bookingVehicle.getVehicleMake() : s.getCustomer().getVehicleMake();
        String vehicleModel = bookingVehicle != null ? bookingVehicle.getVehicleModel() : s.getCustomer().getVehicleModel();
        String vehicleRegistration = bookingVehicle != null
                ? bookingVehicle.getVehicleRegistration()
                : s.getCustomer().getVehicleRegistration();

        return SessionResponse.builder()
                .id(s.getId())
                .bookingId(s.getBooking().getId())
                .bookingReference(s.getBooking().getReferenceId())
                .chargingPointId(s.getChargingPoint().getId())
                .chargingPointIdentifier(s.getChargingPoint().getIdentifier())
                .chargingPointType(s.getChargingPoint().getPointType().name())
                .chargingPointMaxPowerKw(s.getChargingPoint().getMaxPowerKw())
                .customerId(s.getCustomer().getId())
                .customerName(s.getCustomer().getFullName())
                .stationName(s.getChargingPoint().getStation().getName())
                .vehicleId(bookingVehicle != null ? bookingVehicle.getId() : null)
                .vehicleMake(vehicleMake)
                .vehicleModel(vehicleModel)
                .vehicleRegistration(vehicleRegistration)
                .startTime(s.getStartTime())
                .endTime(s.getEndTime())
                .energyDeliveredKwh(s.getEnergyDeliveredKwh())
                .estimateRate(estimateRate)
                .estimateRateType(estimateRateType)
                .estimatedAmount(estimatedAmount)
                .status(s.getStatus().name())
                .build();
    }

    private double normalizedEfficiency() {
        if (billingEfficiencyFactor < 0.0) return 0.0;
        if (billingEfficiencyFactor > 1.0) return 1.0;
        return billingEfficiencyFactor;
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
