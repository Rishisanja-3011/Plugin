package com.plugin.service;

import com.plugin.dto.response.SessionResponse;
import com.plugin.entity.*;
import com.plugin.enums.*;
import com.plugin.exception.*;
import com.plugin.repository.*;
import lombok.RequiredArgsConstructor;
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
    private final PricingRepository pricingRepository;
    private final BillRepository billRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;

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
        double energyKwh = (powerKw * durationMinutes) / 60.0;
        // Add some randomness for realism (80-100% efficiency)
        energyKwh = energyKwh * (0.8 + Math.random() * 0.2);
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
        ChargingPoint cp = session.getChargingPoint();
        Pricing pricing = pricingRepository
                .findByStationIdAndPointType(cp.getStation().getId(), cp.getPointType())
                .orElse(null);

        BigDecimal totalAmount;
        String rateType;
        BigDecimal rate;
        BigDecimal energyKwh = session.getEnergyDeliveredKwh();
        long durationMinutes = Duration.between(session.getStartTime(), session.getEndTime()).toMinutes();

        if (pricing != null) {
            rate = pricing.getRatePerUnit();
            if (pricing.getPricingModel() == PricingModel.PER_KWH) {
                totalAmount = energyKwh.multiply(rate);
                rateType = "PER_KWH";
            } else {
                totalAmount = BigDecimal.valueOf(durationMinutes).multiply(rate);
                rateType = "PER_MINUTE";
            }
        } else {
            rate = BigDecimal.valueOf(15);
            totalAmount = energyKwh.multiply(rate);
            rateType = "PER_KWH";
        }

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

        if (s.getStatus() == SessionStatus.IN_PROGRESS) {
            Pricing pricing = pricingRepository
                    .findByStationIdAndPointType(
                            s.getChargingPoint().getStation().getId(),
                            s.getChargingPoint().getPointType())
                    .orElse(null);

            estimateRate = pricing != null ? pricing.getRatePerUnit() : BigDecimal.valueOf(15);
            estimateRateType = pricing != null ? pricing.getPricingModel().name() : PricingModel.PER_KWH.name();

            long elapsedSeconds = Math.max(0, Duration.between(s.getStartTime(), LocalDateTime.now()).getSeconds());
            BigDecimal elapsedMinutes = BigDecimal.valueOf(elapsedSeconds)
                    .divide(BigDecimal.valueOf(60), 6, RoundingMode.HALF_UP);
            BigDecimal elapsedEnergyKwh = BigDecimal.valueOf(s.getChargingPoint().getMaxPowerKw())
                    .multiply(BigDecimal.valueOf(elapsedSeconds))
                    .divide(BigDecimal.valueOf(3600), 6, RoundingMode.HALF_UP);

            if (PricingModel.PER_MINUTE.name().equals(estimateRateType)) {
                estimatedAmount = elapsedMinutes.multiply(estimateRate);
            } else {
                estimatedAmount = elapsedEnergyKwh.multiply(estimateRate);
            }
            estimatedAmount = estimatedAmount.setScale(2, RoundingMode.HALF_UP);
        }

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
                .startTime(s.getStartTime())
                .endTime(s.getEndTime())
                .energyDeliveredKwh(s.getEnergyDeliveredKwh())
                .estimateRate(estimateRate)
                .estimateRateType(estimateRateType)
                .estimatedAmount(estimatedAmount)
                .status(s.getStatus().name())
                .build();
    }
}
