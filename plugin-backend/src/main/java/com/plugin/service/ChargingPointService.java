package com.plugin.service;

import com.plugin.dto.request.ChargingPointRequest;
import com.plugin.dto.response.ChargingPointResponse;
import com.plugin.entity.ChargingPoint;
import com.plugin.entity.Station;
import com.plugin.enums.PointStatus;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.ChargingPointRepository;
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
    private final AuditService auditService;

    public List<ChargingPointResponse> getByStation(Long stationId) {
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
        Station station = stationRepository.findById(request.getStationId())
                .orElseThrow(() -> new ResourceNotFoundException("Station not found"));
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
        ChargingPoint cp = cpRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Charging point not found"));
        cp.setIdentifier(request.getIdentifier());
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
        ChargingPoint cp = cpRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Charging point not found"));
        cp.setStatus(status);
        cp = cpRepository.save(cp);
        auditService.log("UPDATE_POINT_STATUS", "CHARGING_POINT", cp.getId(), performedBy,
                "Status changed to: " + status);
        return toResponse(cp);
    }

    @Transactional
    public void delete(Long id, String performedBy) {
        ChargingPoint cp = cpRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Charging point not found"));
        auditService.log("DELETE_CHARGING_POINT", "CHARGING_POINT", id, performedBy,
                "Deleted point: " + cp.getIdentifier());
        cpRepository.delete(cp);
    }

    private ChargingPointResponse toResponse(ChargingPoint cp) {
        return ChargingPointResponse.builder()
                .id(cp.getId())
                .identifier(cp.getIdentifier())
                .stationId(cp.getStation().getId())
                .stationName(cp.getStation().getName())
                .pointType(cp.getPointType().name())
                .maxPowerKw(cp.getMaxPowerKw())
                .connectorType(cp.getConnectorType())
                .status(cp.getStatus().name())
                .build();
    }
}
