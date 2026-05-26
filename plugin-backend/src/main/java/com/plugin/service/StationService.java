package com.plugin.service;

import com.plugin.dto.request.StationRequest;
import com.plugin.dto.response.StationLiveSummaryResponse;
import com.plugin.dto.response.StationResponse;
import com.plugin.entity.ChargingPoint;
import com.plugin.entity.Station;
import com.plugin.entity.User;
import com.plugin.enums.PointStatus;
import com.plugin.enums.Role;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.BillRepository;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.StationManagerApplicationRepository;
import com.plugin.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StationService {

    private final StationRepository stationRepository;
    private final ChargingPointRepository chargingPointRepository;
    private final BookingRepository bookingRepository;
    private final BillRepository billRepository;
    private final StationManagerApplicationRepository stationManagerApplicationRepository;
    private final AuditService auditService;
    private final StationOperatorAccessService stationOperatorAccessService;
    private final EntityReferenceResolver referenceResolver;
    private final StationManagerDirectoryService stationManagerDirectoryService;

    public Page<StationResponse> getAllStations(String actorEmail, Pageable pageable) {
        User actor = stationOperatorAccessService.getActor(actorEmail);
        if (actor.getRole() == Role.ADMIN) {
            return toResponsePage(stationRepository.findAll(pageable), pageable);
        }
        return toResponsePage(stationRepository.findByManagerId(actor.getId(), pageable), pageable);
    }

    public Page<StationResponse> getActiveStations(Pageable pageable) {
        return toResponsePage(stationRepository.findAll(pageable), pageable);
    }

    public StationLiveSummaryResponse getLiveSummary() {
        List<Long> activeStationIds = stationRepository.findAll().stream()//(old-findByActiveTrue(),change for aws deployi)
                .map(Station::getId)
                .toList();
        long stationCount = activeStationIds.size();
        long connectorCount = activeStationIds.isEmpty() ? 0 : chargingPointRepository.countByStationIdIn(activeStationIds);
        long available = activeStationIds.isEmpty()
                ? 0
                : chargingPointRepository.countByStationIdInAndStatus(activeStationIds, PointStatus.AVAILABLE);
        long outOfService = activeStationIds.isEmpty()
                ? 0
                : chargingPointRepository.countByStationIdInAndStatus(activeStationIds, PointStatus.OUT_OF_SERVICE);
        long busy = Math.max(0, connectorCount - available - outOfService);
        LocalDateTime lastUpdated = chargingPointRepository.findLatestUpdatedAtForStationIds(activeStationIds);

        return StationLiveSummaryResponse.builder()
                .stationCount(stationCount)
                .connectorCount(connectorCount)
                .available(available)
                .busy(busy)
                .outOfService(outOfService)
                .lastUpdated(lastUpdated)
                .refreshedAt(LocalDateTime.now())
                .build();
    }

    public Page<StationResponse> searchStations(String query, Pageable pageable) {
        String trimmed = query == null ? "" : query.trim();
        if (trimmed.isEmpty()) {
            return Page.empty(pageable);
        }
        if (trimmed.matches("\\d+")) {
            if (trimmed.length() < 6) {
                return Page.empty(pageable);
            }
            return toResponsePage(stationRepository.findByPincode(trimmed, pageable), pageable);
        }
        return toResponsePage(stationRepository.searchStations(trimmed, pageable), pageable);
    }

    public StationResponse getStationById(Long id) {
        Station station = stationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Station not found with id: " + id));
        return toResponse(station);
    }

    @Transactional
    public StationResponse createStation(StationRequest request, String performedBy) {
        stationOperatorAccessService.requireAdmin(performedBy);
        Station station = Station.builder()
                .name(request.getName())
                .address(request.getAddress())
                .city(request.getCity())
                .state(request.getState())
                .pincode(request.getPincode())
                .contactPhone(request.getContactPhone())
                .contactEmail(request.getContactEmail())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .openingTime(request.getOpeningTime())
                .closingTime(request.getClosingTime())
                .active(true)
                .build();
        station = stationRepository.save(station);
        auditService.log("CREATE_STATION", "STATION", station.getId(), performedBy,
                "Created station: " + station.getName());
        return toResponse(station);
    }

    @Transactional
    public StationResponse updateStation(Long id, StationRequest request, String performedBy) {
        Station station = stationOperatorAccessService.getAccessibleStation(id, performedBy);
        station.setName(request.getName());
        station.setAddress(request.getAddress());
        station.setCity(request.getCity());
        station.setState(request.getState());
        station.setPincode(request.getPincode());
        station.setContactPhone(request.getContactPhone());
        station.setContactEmail(request.getContactEmail());
        station.setLatitude(request.getLatitude());
        station.setLongitude(request.getLongitude());
        station.setOpeningTime(request.getOpeningTime());
        station.setClosingTime(request.getClosingTime());
        station = stationRepository.save(station);
        auditService.log("UPDATE_STATION", "STATION", station.getId(), performedBy,
                "Updated station: " + station.getName());
        return toResponse(station);
    }

    @Transactional
    public StationResponse toggleStationStatus(Long id, String performedBy) {
        Station station = stationOperatorAccessService.getAccessibleStation(id, performedBy);
        station.setActive(!station.getActive());
        station = stationRepository.save(station);

        var points = chargingPointRepository.findByStationId(station.getId());
        if (!station.getActive()) {
            points.forEach(point -> point.setStatus(PointStatus.UNAVAILABLE));
            chargingPointRepository.saveAll(points);
        } else {
            points.forEach(point -> point.setStatus(PointStatus.AVAILABLE));
            chargingPointRepository.saveAll(points);
        }

        String action = station.getActive() ? "ACTIVATE_STATION" : "DEACTIVATE_STATION";
        auditService.log(action, "STATION", station.getId(), performedBy,
                (station.getActive() ? "Activated" : "Deactivated") + " station: " + station.getName());
        return toResponse(station);
    }

    @Transactional
    public void deleteStation(Long id, String performedBy) {
        stationOperatorAccessService.requireAdmin(performedBy);
        Station station = stationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Station not found"));

        if (bookingRepository.existsByStationId(id) || billRepository.existsByStationId(id)) {
            throw new BadRequestException(
                    "This station cannot be removed because it already has booking or billing history. Please deactivate it instead."
            );
        }

        stationManagerApplicationRepository.findByApprovedStationId(id).ifPresent(application -> {
            application.setApprovedStation(null);
            stationManagerApplicationRepository.save(application);
            stationManagerDirectoryService.upsertFromApplication(application);
        });

        auditService.log("DELETE_STATION", "STATION", id, performedBy,
                "Deleted station: " + station.getName());
        stationRepository.delete(station);
    }

    private StationResponse toResponse(Station station) {
        station = referenceResolver.resolveStation(station, station.getId());
        long total = chargingPointRepository.countByStationId(station.getId());
        long available = chargingPointRepository.countByStationIdAndStatus(station.getId(), PointStatus.AVAILABLE);
        return toResponse(station, total, available);
    }

    private Page<StationResponse> toResponsePage(Page<Station> stationPage, Pageable pageable) {
        List<Station> stations = stationPage.getContent();
        List<Long> stationIds = stations.stream()
                .map(Station::getId)
                .toList();
        List<ChargingPoint> points = stationIds.isEmpty()
                ? List.of()
                : chargingPointRepository.findByStationIdIn(stationIds);
        Map<Long, Long> totalCounts = points.stream()
                .collect(Collectors.groupingBy(ChargingPoint::getStationId, Collectors.counting()));
        Map<Long, Long> availableCounts = points.stream()
                .filter(point -> point.getStatus() == PointStatus.AVAILABLE)
                .collect(Collectors.groupingBy(ChargingPoint::getStationId, Collectors.counting()));

        List<StationResponse> content = stations.stream()
                .map(station -> {
                    Station resolved = referenceResolver.resolveStation(station, station.getId());
                    Long stationId = resolved.getId();
                    return toResponse(
                            resolved,
                            totalCounts.getOrDefault(stationId, 0L),
                            availableCounts.getOrDefault(stationId, 0L)
                    );
                })
                .toList();
        return new PageImpl<>(content, pageable, stationPage.getTotalElements());
    }

    private StationResponse toResponse(Station station, long total, long available) {
        return StationResponse.builder()
                .id(station.getId())
                .name(station.getName())
                .address(station.getAddress())
                .city(station.getCity())
                .state(station.getState())
                .pincode(station.getPincode())
                .contactPhone(station.getContactPhone())
                .contactEmail(station.getContactEmail())
                .managerId(station.getManager() != null ? station.getManager().getId() : null)
                .managerName(station.getManager() != null ? station.getManager().getFullName() : null)
                .latitude(station.getLatitude())
                .longitude(station.getLongitude())
                .openingTime(station.getOpeningTime())
                .closingTime(station.getClosingTime())
                .active(station.getActive())
                .createdAt(station.getCreatedAt())
                .totalPoints(total)
                .availablePoints(available)
                .build();
    }
}
