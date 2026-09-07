package com.plugin.service;

import com.plugin.entity.ChargingPoint;
import com.plugin.entity.Station;
import com.plugin.enums.PointStatus;
import com.plugin.enums.SessionStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.BillRepository;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.ChargingSessionRepository;
import com.plugin.repository.StationManagerApplicationRepository;
import com.plugin.repository.StationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationServiceSecurityTest {

    @Mock private StationRepository stationRepository;
    @Mock private ChargingPointRepository chargingPointRepository;
    @Mock private ChargingSessionRepository chargingSessionRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private BillRepository billRepository;
    @Mock private StationManagerApplicationRepository applicationRepository;
    @Mock private AuditService auditService;
    @Mock private StationOperatorAccessService accessService;
    @Mock private EntityReferenceResolver referenceResolver;
    @Mock private StationManagerDirectoryService directoryService;

    @InjectMocks private StationService stationService;

    @Test
    void refusesToDeactivateStationWithActiveChargingSession() {
        Station station = Station.builder().id(10L).name("Station").active(true).build();
        ChargingPoint point = ChargingPoint.builder().id(11L).stationId(10L).build();
        when(accessService.getAccessibleStation(10L, "operator@example.com")).thenReturn(station);
        when(chargingPointRepository.findByStationId(10L)).thenReturn(List.of(point));
        when(chargingSessionRepository.countByChargingPointIdInAndStatus(
                List.of(11L), SessionStatus.IN_PROGRESS)).thenReturn(1L);

        assertThrows(BadRequestException.class,
                () -> stationService.toggleStationStatus(10L, "operator@example.com"));

        verify(stationRepository, never()).save(any(Station.class));
    }

    @Test
    void reactivationDoesNotOverwriteConnectorSafetyState() {
        Station station = Station.builder().id(20L).name("Station").active(false).build();
        ChargingPoint point = ChargingPoint.builder()
                .id(21L)
                .stationId(20L)
                .status(PointStatus.OUT_OF_SERVICE)
                .build();
        when(accessService.getAccessibleStation(20L, "operator@example.com")).thenReturn(station);
        when(stationRepository.save(station)).thenReturn(station);
        when(referenceResolver.resolveStation(station, 20L)).thenReturn(station);

        stationService.toggleStationStatus(20L, "operator@example.com");

        assertTrue(station.getActive());
        assertEquals(PointStatus.OUT_OF_SERVICE, point.getStatus());
        verify(chargingPointRepository, never()).findByStationId(20L);
        verify(chargingPointRepository, never()).saveAll(any());
    }
}
