package com.plugin.service;

import com.plugin.config.AppClock;
import com.plugin.entity.Booking;
import com.plugin.entity.ChargingPoint;
import com.plugin.entity.ChargingSession;
import com.plugin.entity.Station;
import com.plugin.entity.User;
import com.plugin.enums.BookingStatus;
import com.plugin.enums.PointStatus;
import com.plugin.enums.Role;
import com.plugin.enums.SessionStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.BillRepository;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.ChargingSessionRepository;
import com.plugin.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionServiceSecurityTest {

    @Mock private ChargingSessionRepository sessionRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private ChargingPointRepository cpRepository;
    @Mock private UserRepository userRepository;
    @Mock private BillRepository billRepository;
    @Mock private PricingSnapshotService pricingSnapshotService;
    @Mock private AuditService auditService;
    @Mock private NotificationService notificationService;
    @Mock private EntityReferenceResolver referenceResolver;
    @Mock private WalletService walletService;
    @Mock private ChargerCommandService chargerCommandService;
    @Mock private InvoiceEmailService invoiceEmailService;
    @Mock private TaskScheduler taskScheduler;
    @Mock private TransactionTemplate transactionTemplate;

    @InjectMocks private SessionService sessionService;

    @Test
    void hidesAnotherCustomersSession() {
        ChargingSession session = ChargingSession.builder()
                .id(71L)
                .customerId(10L)
                .status(SessionStatus.IN_PROGRESS)
                .build();
        User attacker = User.builder()
                .id(11L)
                .email("attacker@example.com")
                .role(Role.CUSTOMER)
                .build();
        when(sessionRepository.findById(71L)).thenReturn(Optional.of(session));
        when(userRepository.findByEmail(attacker.getEmail())).thenReturn(Optional.of(attacker));

        assertThrows(ResourceNotFoundException.class,
                () -> sessionService.getSessionForCaller(71L, attacker.getEmail()));

        verify(referenceResolver, never()).hydrate(any(ChargingSession.class));
    }

    @Test
    void currentOutOfServiceStateOverridesStaleEmbeddedAvailableState() {
        User customer = User.builder()
                .id(12L)
                .email("owner@example.com")
                .role(Role.CUSTOMER)
                .build();
        Station station = Station.builder().id(13L).name("Station").active(true).build();
        ChargingPoint embeddedAvailable = ChargingPoint.builder()
                .id(14L)
                .station(station)
                .stationId(station.getId())
                .status(PointStatus.AVAILABLE)
                .build();
        LocalDateTime now = AppClock.now();
        Booking booking = Booking.builder()
                .id(15L)
                .referenceId("BK-STALE")
                .customer(customer)
                .customerId(customer.getId())
                .station(station)
                .stationId(station.getId())
                .chargingPoint(embeddedAvailable)
                .chargingPointId(embeddedAvailable.getId())
                .status(BookingStatus.CONFIRMED)
                .startTime(AppClock.toStoredScheduleTime(now.minusMinutes(1)))
                .endTime(AppClock.toStoredScheduleTime(now.plusMinutes(59)))
                .build();
        ChargingPoint currentOutOfService = ChargingPoint.builder()
                .id(embeddedAvailable.getId())
                .station(station)
                .stationId(station.getId())
                .status(PointStatus.OUT_OF_SERVICE)
                .build();

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(referenceResolver.hydrate(booking)).thenReturn(booking);
        when(userRepository.findByEmail(customer.getEmail())).thenReturn(Optional.of(customer));
        when(sessionRepository.findByBookingId(booking.getId())).thenReturn(Optional.empty());
        when(cpRepository.findById(embeddedAvailable.getId())).thenReturn(Optional.of(currentOutOfService));
        when(referenceResolver.hydrate(currentOutOfService)).thenReturn(currentOutOfService);

        BadRequestException exception = assertThrows(BadRequestException.class,
                () -> sessionService.startSession(booking.getId(), customer.getEmail()));

        assertEquals("Charging point is currently unavailable. Please wait for admin to restore it.",
                exception.getMessage());
        verify(walletService, never()).ensureReadyForSessionStart(any());
        verify(bookingRepository, never()).save(any());
        verify(cpRepository, never()).claimPointForSession(any(), any(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void customerCannotEndAnotherCustomersSession() {
        User owner = User.builder().id(21L).email("owner@example.com").build();
        ChargingSession victimSession = ChargingSession.builder()
                .id(22L)
                .customer(owner)
                .customerId(owner.getId())
                .status(SessionStatus.IN_PROGRESS)
                .build();
        User attacker = User.builder().id(23L).email("attacker@example.com").build();
        when(transactionTemplate.execute(any(TransactionCallback.class))).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(mock(TransactionStatus.class));
        });
        when(sessionRepository.findById(victimSession.getId())).thenReturn(Optional.of(victimSession));
        when(referenceResolver.hydrate(victimSession)).thenReturn(victimSession);
        when(userRepository.findByEmail(attacker.getEmail())).thenReturn(Optional.of(attacker));

        assertThrows(ResourceNotFoundException.class,
                () -> sessionService.endMySession(victimSession.getId(), attacker.getEmail()));

        verify(sessionRepository, never()).save(any());
        verify(cpRepository, never()).releasePointForSession(any(), any());
        verify(billRepository, never()).save(any());
    }
}
