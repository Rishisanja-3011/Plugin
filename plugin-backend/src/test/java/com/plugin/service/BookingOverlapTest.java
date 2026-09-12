package com.plugin.service;

import com.plugin.dto.request.BookingLocationPingRequest;
import com.plugin.dto.request.BookingRequest;
import com.plugin.dto.response.BookingResponse;
import com.plugin.entity.*;
import com.plugin.enums.*;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ConflictException;
import com.plugin.exception.ResourceNotFoundException;
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
    @Mock private UserVehicleRepository userVehicleRepository;
    @Mock private PricingSnapshotService pricingSnapshotService;
    @Mock private AuditService auditService;
    @Mock private NotificationService notificationService;
    @Mock private ChargingSessionRepository sessionRepository;
    @Mock private BookingTransactionRunner transactionRunner;
    @Mock private EtaSlotAllocator etaSlotAllocator;

    @InjectMocks
    private BookingService bookingService;

    private User customer;
    private Station station;
    private ChargingPoint chargingPoint;

    @BeforeEach
    void setUp() {
        lenient().when(transactionRunner.execute(any())).thenAnswer(call ->
                ((java.util.function.Supplier<?>) call.getArgument(0)).get());
        customer = User.builder()
                .id(1L)
                .email("test@test.com")
                .fullName("Test")
                .role(Role.CUSTOMER)
                .vehicleMake("Tesla")
                .vehicleModel("Model 3")
                .vehicleRegistration("MH01AB1234")
                .build();
        station = Station.builder().id(1L).name("Test Station").active(true)
                .openingTime(LocalTime.of(6, 0)).closingTime(LocalTime.of(23, 0)).build();
        chargingPoint = ChargingPoint.builder().id(1L).identifier("CP-01").station(station)
                .pointType(PointType.FAST).maxPowerKw(150.0).status(PointStatus.AVAILABLE).build();
        lenient().when(userRepository.findByEmail(customer.getEmail()))
                .thenReturn(Optional.of(customer));
        lenient().when(cpRepository.findByStationId(station.getId()))
                .thenReturn(List.of(chargingPoint));
        lenient().when(userVehicleRepository.findFirstByUserIdAndActiveTrue(anyLong()))
                .thenReturn(Optional.empty());
        lenient().when(userVehicleRepository.findByUserIdOrderByActiveDescCreatedAtDesc(anyLong()))
                .thenReturn(List.of());
        lenient().when(userVehicleRepository.save(any(UserVehicle.class)))
                .thenAnswer(invocation -> {
                    UserVehicle vehicle = invocation.getArgument(0);
                    if (vehicle.getId() == null) {
                        vehicle.setId(100L);
                    }
                    return vehicle;
                });
        lenient().when(pricingSnapshotService.resolveFor(any(), any(), any(), any()))
                .thenReturn(new PricingSnapshotService.PricingSnapshot(
                        BigDecimal.valueOf(18),
                        BigDecimal.valueOf(20),
                        BigDecimal.TEN,
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

    @Test
    void shouldUseEarliestSavedVehicleForLegacyBookingWithoutVehicleLink() {
        User legacyCustomer = User.builder()
                .id(42L)
                .email("legacy@test.com")
                .fullName("Legacy Customer")
                .vehicleMake("BMW")
                .vehicleModel("i009")
                .vehicleRegistration("GJ04EA4145")
                .build();

        UserVehicle originalVehicle = UserVehicle.builder()
                .id(7L)
                .user(legacyCustomer)
                .vehicleNickname("Office car")
                .vehicleMake("Tata")
                .vehicleModel("Nexon EV")
                .vehicleRegistration("GJ01AA0001")
                .active(false)
                .build();

        Booking legacyBooking = Booking.builder()
                .id(11L)
                .referenceId("BK-LEGACY1")
                .customer(legacyCustomer)
                .station(station)
                .chargingPoint(chargingPoint)
                .startTime(LocalDateTime.now().plusDays(1))
                .endTime(LocalDateTime.now().plusDays(1).plusHours(1))
                .status(BookingStatus.CONFIRMED)
                .build();

        when(bookingRepository.findById(11L)).thenReturn(Optional.of(legacyBooking));
        when(userVehicleRepository.findFirstByUserIdOrderByCreatedAtAscIdAsc(42L))
                .thenReturn(Optional.of(originalVehicle));

        BookingResponse response = bookingService.getBookingById(11L);

        assertEquals(7L, response.getVehicleId());
        assertEquals("Office car", response.getVehicleNickname());
        assertEquals("Tata", response.getVehicleMake());
        assertEquals("Nexon EV", response.getVehicleModel());
        assertEquals("GJ01AA0001", response.getVehicleRegistration());
    }

    @Test
    void shouldRejectBookingWhenCustomerHasNoVehicle() {
        User customerWithoutVehicle = User.builder()
                .id(50L)
                .email("novehicle@test.com")
                .fullName("No Vehicle")
                .role(Role.CUSTOMER)
                .build();

        BookingRequest request = new BookingRequest();
        request.setStationId(1L);
        request.setChargingPointId(1L);
        request.setStartTime(LocalDateTime.now().plusDays(1).withHour(12).withMinute(0));
        request.setDurationMinutes(60);

        when(userRepository.findByEmail("novehicle@test.com")).thenReturn(Optional.of(customerWithoutVehicle));
        when(userVehicleRepository.findFirstByUserIdAndActiveTrue(50L)).thenReturn(Optional.empty());
        when(userVehicleRepository.findByUserIdOrderByActiveDescCreatedAtDesc(50L)).thenReturn(List.of());

        BadRequestException exception = assertThrows(BadRequestException.class, () ->
                bookingService.createBooking(request, "novehicle@test.com"));

        assertEquals("Please add a vehicle in your profile before booking a charging session", exception.getMessage());
    }

    @Test
    void shouldRejectBookingWhenPointIsUnavailable() {
        chargingPoint.setStatus(PointStatus.UNAVAILABLE);

        BookingRequest request = new BookingRequest();
        request.setStationId(1L);
        request.setChargingPointId(1L);
        request.setStartTime(LocalDateTime.now().plusDays(1).withHour(12).withMinute(0));
        request.setDurationMinutes(60);

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(customer));
        when(stationRepository.findById(1L)).thenReturn(Optional.of(station));
        when(cpRepository.findById(1L)).thenReturn(Optional.of(chargingPoint));

        BadRequestException exception = assertThrows(BadRequestException.class, () ->
                bookingService.createBooking(request, "test@test.com"));

        assertEquals("Charging point is currently unavailable for booking", exception.getMessage());
    }

    @Test
    void shouldRejectAutoAssignWhenAllPointsAreBlocked() {
        ChargingPoint outOfServicePoint = ChargingPoint.builder()
                .id(2L)
                .identifier("CP-02")
                .station(station)
                .pointType(PointType.FAST)
                .maxPowerKw(150.0)
                .status(PointStatus.OUT_OF_SERVICE)
                .build();
        ChargingPoint unavailablePoint = ChargingPoint.builder()
                .id(3L)
                .identifier("CP-03")
                .station(station)
                .pointType(PointType.FAST)
                .maxPowerKw(150.0)
                .status(PointStatus.UNAVAILABLE)
                .build();

        BookingRequest request = new BookingRequest();
        request.setStationId(1L);
        request.setStartTime(LocalDateTime.now().plusDays(1).withHour(12).withMinute(0));
        request.setDurationMinutes(60);

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(customer));
        when(stationRepository.findById(1L)).thenReturn(Optional.of(station));
        when(cpRepository.findByStationId(1L)).thenReturn(List.of(outOfServicePoint, unavailablePoint));

        ConflictException exception = assertThrows(ConflictException.class, () ->
                bookingService.createBooking(request, "test@test.com"));

        assertEquals("No available charging points for the requested time slot", exception.getMessage());
    }

    @Test
    void shouldRejectLocationUpdatesForFixedBookings() {
        Booking fixedBooking = Booking.builder()
                .id(21L)
                .referenceId("BK-FIXED")
                .customer(customer)
                .station(station)
                .chargingPoint(chargingPoint)
                .chargingPointId(chargingPoint.getId())
                .virtualSpot(false)
                .status(BookingStatus.CONFIRMED)
                .startTime(LocalDateTime.now().plusHours(1))
                .endTime(LocalDateTime.now().plusHours(2))
                .build();
        BookingLocationPingRequest ping = new BookingLocationPingRequest();
        ping.setLatitude(19.0760);
        ping.setLongitude(72.8777);

        when(bookingRepository.findById(21L)).thenReturn(Optional.of(fixedBooking));

        BadRequestException exception = assertThrows(BadRequestException.class,
                () -> bookingService.updateBookingLocation(21L, ping, customer.getEmail()));

        assertEquals("Location updates are only accepted for ETA bookings", exception.getMessage());
        verifyNoInteractions(cpRepository);
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void shouldRejectCancellationAfterChargingSessionStarts() {
        Booking booking = Booking.builder()
                .id(22L)
                .referenceId("BK-ACTIVE")
                .customer(customer)
                .station(station)
                .chargingPoint(chargingPoint)
                .chargingPointId(chargingPoint.getId())
                .status(BookingStatus.CONFIRMED)
                .startTime(LocalDateTime.now().minusMinutes(5))
                .endTime(LocalDateTime.now().plusMinutes(55))
                .build();
        ChargingSession activeSession = ChargingSession.builder()
                .id(31L)
                .booking(booking)
                .customer(customer)
                .status(SessionStatus.IN_PROGRESS)
                .build();

        when(bookingRepository.findById(22L)).thenReturn(Optional.of(booking));
        when(sessionRepository.findByBookingId(22L)).thenReturn(Optional.of(activeSession));

        BadRequestException exception = assertThrows(BadRequestException.class,
                () -> bookingService.cancelBooking(22L, customer.getEmail(), "Changed plans"));

        assertEquals("Cannot cancel a booking after charging has started", exception.getMessage());
        verify(cpRepository, never()).releaseReservationForBooking(anyLong(), anyLong());
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void shouldHideAnotherCustomersBooking() {
        User attacker = User.builder()
                .id(61L)
                .email("attacker@example.com")
                .role(Role.CUSTOMER)
                .build();
        Booking victimBooking = Booking.builder()
                .id(62L)
                .customer(customer)
                .customerId(customer.getId())
                .status(BookingStatus.CONFIRMED)
                .build();
        when(bookingRepository.findById(victimBooking.getId())).thenReturn(Optional.of(victimBooking));
        when(userRepository.findByEmail(attacker.getEmail())).thenReturn(Optional.of(attacker));

        assertThrows(ResourceNotFoundException.class,
                () -> bookingService.getBookingForCaller(victimBooking.getId(), attacker.getEmail()));
    }
}
