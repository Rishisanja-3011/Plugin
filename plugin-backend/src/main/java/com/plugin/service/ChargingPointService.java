package com.plugin.service;

import com.plugin.dto.request.ChargingPointRequest;
import com.plugin.dto.response.ChargingPointResponse;
import com.plugin.entity.ChargingPoint;
import com.plugin.entity.Station;
import com.plugin.enums.PointStatus;
import com.plugin.enums.BookingStatus;
import com.plugin.enums.SessionStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.ChargingSessionRepository;
import com.plugin.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChargingPointService {

    private final ChargingPointRepository cpRepository;
    private final StationRepository stationRepository;
    private final BookingRepository bookingRepository;
    private final ChargingSessionRepository sessionRepository;
    private final AuditService auditService;
    private final StationOperatorAccessService stationOperatorAccessService;
    private final EntityReferenceResolver referenceResolver;

    public List<ChargingPointResponse> getByStation(Long stationId) {
        stationRepository.findByIdAndActiveTrue(stationId)
                .orElseThrow(() -> new ResourceNotFoundException("Station not found"));
        return cpRepository.findByStationId(stationId).stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    public List<ChargingPointResponse> getByStation(Long stationId, String actorEmail) {
        stationOperatorAccessService.getAccessibleStation(stationId, actorEmail);
        return cpRepository.findByStationId(stationId).stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    public ChargingPointResponse getById(Long id) {
        ChargingPoint cp = cpRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Charging point not found"));
        return toResponse(cp);
    }

    @Transactional
    public ChargingPointResponse create(ChargingPointRequest request, String performedBy) {
        Station station = stationOperatorAccessService.getAccessibleStation(request.getStationId(), performedBy);
        ChargingPoint cp = ChargingPoint.builder()
                .identifier(request.getIdentifier())
                .station(station)
                .pointType(request.getPointType())
                .maxPowerKw(request.getMaxPowerKw())
                .connectorType(request.getConnectorType())
                .status(PointStatus.AVAILABLE)
                .build();
        cp = cpRepository.save(cp);
        auditService.log("CREATE_CHARGING_POINT", "CHARGING_POINT", cp.getId(), performedBy,
                "Created point: " + cp.getIdentifier());
        return toResponse(cp);
    }

    @Transactional
    public ChargingPointResponse update(Long id, ChargingPointRequest request, String performedBy) {
        ChargingPoint cp = stationOperatorAccessService.getAccessibleChargingPoint(id, performedBy);
        ensureConnectorCanBeEdited(cp);
        Station station = stationOperatorAccessService.getAccessibleStation(request.getStationId(), performedBy);
        cp.setIdentifier(request.getIdentifier());
        cp.setStation(station);
        cp.setPointType(request.getPointType());
        cp.setMaxPowerKw(request.getMaxPowerKw());
        cp.setConnectorType(request.getConnectorType());
        cp = cpRepository.save(cp);
        auditService.log("UPDATE_CHARGING_POINT", "CHARGING_POINT", cp.getId(), performedBy,
                "Updated point: " + cp.getIdentifier());
        return toResponse(cp);
    }

    @Transactional
    public ChargingPointResponse updateStatus(Long id, PointStatus status, String performedBy) {
        ChargingPoint cp = stationOperatorAccessService.getAccessibleChargingPoint(id, performedBy);
        if (status == PointStatus.RESERVED || status == PointStatus.CHARGING) {
            throw new BadRequestException("Reserved and charging states are controlled by the booking system");
        }
        ensureConnectorHasNoLiveOwner(cp);
        cp.setStatus(status);
        cp = cpRepository.save(cp);
        auditService.log("UPDATE_POINT_STATUS", "CHARGING_POINT", cp.getId(), performedBy,
                "Status changed to: " + status);
        return toResponse(cp);
    }

    @Transactional
    public void delete(Long id, String performedBy) {
        ChargingPoint cp = stationOperatorAccessService.getAccessibleChargingPoint(id, performedBy);
        ensureConnectorHasNoLiveOwner(cp);
        if (bookingRepository.existsByChargingPointId(id)
                || sessionRepository.existsByChargingPointId(id)) {
            throw new BadRequestException(
                    "A charging point with booking or session history cannot be deleted; mark it out of service instead");
        }
        auditService.log("DELETE_CHARGING_POINT", "CHARGING_POINT", id, performedBy,
                "Deleted point: " + cp.getIdentifier());
        cpRepository.delete(cp);
    }

    private void ensureConnectorCanBeEdited(ChargingPoint point) {
        ensureConnectorHasNoLiveOwner(point);
        if (bookingRepository.existsByChargingPointIdAndStatusIn(point.getId(),
                List.of(BookingStatus.CONFIRMED, BookingStatus.MODIFIED, BookingStatus.IN_PROGRESS))) {
            throw new BadRequestException("A charging point with an active booking cannot be edited");
        }
    }

    private void ensureConnectorHasNoLiveOwner(ChargingPoint point) {
        if (point.getActiveSessionId() != null
                || point.getReservedByBookingId() != null
                || point.getStatus() == PointStatus.CHARGING
                || point.getStatus() == PointStatus.RESERVED
                || sessionRepository.existsByChargingPointIdAndStatus(point.getId(), SessionStatus.IN_PROGRESS)) {
            throw new BadRequestException(
                    "This charging point is owned by an active booking or session and cannot be changed manually");
        }
    }

    private ChargingPointResponse toResponse(ChargingPoint cp) {
        cp = referenceResolver.hydrate(cp);
        Station station = cp.getStation();
        return ChargingPointResponse.builder()
                .id(cp.getId())
                .identifier(cp.getIdentifier())
                .stationId(station != null ? station.getId() : cp.getStationId())
                .stationName(station != null ? station.getName() : null)
                .pointType(cp.getPointType().name())
                .maxPowerKw(cp.getMaxPowerKw())
                .connectorType(cp.getConnectorType())
                .status(cp.getStatus().name())
                .build();
    }
}
