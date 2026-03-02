package com.plugin.service;

import com.plugin.dto.request.BookingRequest;
import com.plugin.entity.*;
import com.plugin.enums.*;
import com.plugin.exception.ConflictException;
import com.plugin.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingOverlapTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private StationRepository stationRepository;
    @Mock private ChargingPointRepository cpRepository;
    @Mock private UserRepository userRepository;
    @Mock private PricingSnapshotService pricingSnapshotService;
    @Mock private AuditService auditService;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private BookingService bookingService;

    private User customer;
    private Station station;
    private ChargingPoint chargingPoint;

    @BeforeEach
    void setUp() {
        customer = User.builder().id(1L).email("test@test.com").fullName("Test").role(Role.CUSTOMER).build();
        station = Station.builder().id(1L).name("Test Station").active(true)
                .openingTime(LocalTime.of(6, 0)).closingTime(LocalTime.of(23, 0)).build();
        chargingPoint = ChargingPoint.builder().id(1L).identifier("CP-01").station(station)
                .pointType(PointType.FAST).maxPowerKw(150.0).status(PointStatus.AVAILABLE).build();
        lenient().when(pricingSnapshotService.resolveFor(any(), any()))
                .thenReturn(new PricingSnapshotService.PricingSnapshot(
                        BigDecimal.valueOf(18),
                        PricingModel.PER_KWH.name(),
                        false
                ));
    }

    @Test
    void shouldRejectOverlappingBooking() {
        // Existing booking: 10:00 - 11:00
        Booking existing = Booking.builder()
                .id(10L)
                .chargingPoint(chargingPoint)
                .startTime(LocalDateTime.now().plusDays(1).withHour(10).withMinute(0))
                .endTime(LocalDateTime.now().plusDays(1).withHour(11).withMinute(0))
                .status(BookingStatus.CONFIRMED)
                .build();

        BookingRequest request = new BookingRequest();
        request.setStationId(1L);
        request.setChargingPointId(1L);
        // New booking: 10:30 - 11:30 (overlaps)
        request.setStartTime(LocalDateTime.now().plusDays(1).withHour(10).withMinute(30));
        request.setDurationMinutes(60);

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(customer));
        when(stationRepository.findById(1L)).thenReturn(Optional.of(station));
        when(cpRepository.findById(1L)).thenReturn(Optional.of(chargingPoint));
        when(bookingRepository.findOverlappingBookings(eq(1L), any(), any()))
                .thenReturn(List.of(existing));

        assertThrows(ConflictException.class, () ->
                bookingService.createBooking(request, "test@test.com"));
    }

    @Test
    void shouldAllowNonOverlappingBooking() {
        BookingRequest request = new BookingRequest();
        request.setStationId(1L);
        request.setChargingPointId(1L);
        // New booking: 12:00 - 13:00 (no overlap)
        request.setStartTime(LocalDateTime.now().plusDays(1).withHour(12).withMinute(0));
        request.setDurationMinutes(60);

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(customer));
        when(stationRepository.findById(1L)).thenReturn(Optional.of(station));
        when(cpRepository.findById(1L)).thenReturn(Optional.of(chargingPoint));
        when(bookingRepository.findOverlappingBookings(eq(1L), any(), any()))
                .thenReturn(List.of()); // No overlaps
        when(bookingRepository.save(any())).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            b.setId(99L);
            b.setCreatedAt(LocalDateTime.now());
            return b;
        });

        BookingRequest req = request;
        assertDoesNotThrow(() -> bookingService.createBooking(req, "test@test.com"));
    }
}
