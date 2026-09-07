package com.plugin.service;

import com.plugin.dto.request.ChargingPointRequest;
import com.plugin.entity.ChargingPoint;
import com.plugin.enums.PointStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.ChargingSessionRepository;
import com.plugin.repository.StationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChargingPointServiceSecurityTest {

    @Mock private ChargingPointRepository chargingPointRepository;
    @Mock private StationRepository stationRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private ChargingSessionRepository sessionRepository;
    @Mock private AuditService auditService;
    @Mock private StationOperatorAccessService accessService;
    @Mock private EntityReferenceResolver referenceResolver;

    @InjectMocks private ChargingPointService chargingPointService;

    @Test
    void manualApiCannotForgeSystemOwnedChargingState() {
        ChargingPoint point = ChargingPoint.builder().id(10L).status(PointStatus.AVAILABLE).build();
        when(accessService.getAccessibleChargingPoint(10L, "operator@example.com")).thenReturn(point);

        assertThrows(BadRequestException.class,
                () -> chargingPointService.updateStatus(
                        10L, PointStatus.CHARGING, "operator@example.com"));

        verify(chargingPointRepository, never()).save(any(ChargingPoint.class));
    }

    @Test
    void activeSessionOwnershipBlocksManualStatusChanges() {
        ChargingPoint point = ChargingPoint.builder()
                .id(20L)
                .status(PointStatus.CHARGING)
                .activeSessionId(21L)
                .build();
        when(accessService.getAccessibleChargingPoint(20L, "operator@example.com")).thenReturn(point);

        assertThrows(BadRequestException.class,
                () -> chargingPointService.updateStatus(
                        20L, PointStatus.AVAILABLE, "operator@example.com"));

        verify(chargingPointRepository, never()).save(any(ChargingPoint.class));
    }

    @Test
    void connectorHistoryMustBeRetainedInsteadOfDeleted() {
        ChargingPoint point = ChargingPoint.builder().id(30L).status(PointStatus.OUT_OF_SERVICE).build();
        when(accessService.getAccessibleChargingPoint(30L, "admin@example.com")).thenReturn(point);
        when(bookingRepository.existsByChargingPointId(30L)).thenReturn(true);

        assertThrows(BadRequestException.class,
                () -> chargingPointService.delete(30L, "admin@example.com"));

        verify(chargingPointRepository, never()).delete(any(ChargingPoint.class));
    }

    @Test
    void activeBookingBlocksConnectorIdentityEdits() {
        ChargingPoint point = ChargingPoint.builder().id(40L).status(PointStatus.AVAILABLE).build();
        when(accessService.getAccessibleChargingPoint(40L, "operator@example.com")).thenReturn(point);
        when(bookingRepository.existsByChargingPointIdAndStatusIn(any(), any())).thenReturn(true);

        assertThrows(BadRequestException.class,
                () -> chargingPointService.update(
                        40L, new ChargingPointRequest(), "operator@example.com"));

        verify(chargingPointRepository, never()).save(any(ChargingPoint.class));
    }
}
