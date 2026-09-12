package com.plugin.service;

import com.plugin.dto.request.StationRequest;
import com.plugin.dto.response.StationLiveSummaryResponse;
import com.plugin.dto.response.StationResponse;
import com.plugin.entity.ChargingPoint;
import com.plugin.entity.Station;
import com.plugin.entity.User;
import com.plugin.enums.PointStatus;
import com.plugin.enums.Role;
import com.plugin.enums.SessionStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.BillRepository;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.ChargingSessionRepository;
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
    private final ChargingSessionRepository chargingSessionRepository;
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
            return toResponsePage(stationRepository.findAll(pageable), pageable, true);
        }
        return toResponsePage(stationRepository.findByManagerId(actor.getId(), pageable), pageable, true);
    }

    public Page<StationResponse> getActiveStations(Pageable pageable) {
        return toResponsePage(stationRepository.findByActiveTrue(pageable), pageable, false);
    }

    public StationLiveSummaryResponse getLiveSummary() {
        List<Long> activeStationIds = stationRepository.findByActiveTrue().stream()
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
        if (trimmed.length() > 100) {
            throw new BadRequestException("Search query must not exceed 100 characters");
        }
        if (trimmed.matches("\\d+")) {
            if (trimmed.length() < 6) {
                return Page.empty(pageable);
            }
            return toResponsePage(stationRepository.findByActiveTrueAndPincode(trimmed, pageable), pageable, false);
        }
        return toResponsePage(stationRepository.searchStations(trimmed, pageable), pageable, false);
    }

    public StationResponse getStationById(Long id) {
        Station station = stationRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new ResourceNotFoundException("Station not found with id: " + id));
        return toResponse(station, false);
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
                .localSolarCurrentKw(request.getLocalSolarCurrentKw())
                .localSolarForecastKw(request.getLocalSolarForecastKw())
                .batteryCapacityKwh(request.getBatteryCapacityKwh())
                .batteryStateOfChargePercent(request.getBatteryStateOfChargePercent())
                .gridImportLimitKw(request.getGridImportLimitKw())
                .emergencyReservePercent(request.getEmergencyReservePercent())
                .renewableAvailableForChargingKw(request.getRenewableAvailableForChargingKw())
                .stationUtilizationPercent(request.getStationUtilizationPercent())
                .renewableDataMode(request.getRenewableDataMode())
                .energyUpdatedAt(request.getEnergyUpdatedAt())
                .minimumRatePerKwh(request.getMinimumRatePerKwh())
                .maximumDiscountPercent(request.getMaximumDiscountPercent())
                .active(true)
                .build();
        station = stationRepository.save(station);
        auditService.log("CREATE_STATION", "STATION", station.getId(), performedBy,
                "Created station: " + station.getName());
        return toResponse(station, true);
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
        // Legacy station forms do not submit energy telemetry. Preserve the last
        // operator reading unless a newer value is explicitly supplied.
        if (request.getLocalSolarCurrentKw() != null) station.setLocalSolarCurrentKw(request.getLocalSolarCurrentKw());
        if (request.getLocalSolarForecastKw() != null) station.setLocalSolarForecastKw(request.getLocalSolarForecastKw());
        if (request.getBatteryCapacityKwh() != null) station.setBatteryCapacityKwh(request.getBatteryCapacityKwh());
        if (request.getBatteryStateOfChargePercent() != null) station.setBatteryStateOfChargePercent(request.getBatteryStateOfChargePercent());
        if (request.getGridImportLimitKw() != null) station.setGridImportLimitKw(request.getGridImportLimitKw());
        if (request.getEmergencyReservePercent() != null) station.setEmergencyReservePercent(request.getEmergencyReservePercent());
        if (request.getRenewableAvailableForChargingKw() != null) station.setRenewableAvailableForChargingKw(request.getRenewableAvailableForChargingKw());
        if (request.getStationUtilizationPercent() != null) station.setStationUtilizationPercent(request.getStationUtilizationPercent());
        if (request.getRenewableDataMode() != null) station.setRenewableDataMode(request.getRenewableDataMode());
        if (request.getEnergyUpdatedAt() != null) station.setEnergyUpdatedAt(request.getEnergyUpdatedAt());
        if (request.getMinimumRatePerKwh() != null) station.setMinimumRatePerKwh(request.getMinimumRatePerKwh());
        if (request.getMaximumDiscountPercent() != null) station.setMaximumDiscountPercent(request.getMaximumDiscountPercent());
        station = stationRepository.save(station);
        auditService.log("UPDATE_STATION", "STATION", station.getId(), performedBy,
                "Updated station: " + station.getName());
        return toResponse(station, true);
    }

    @Transactional
    public StationResponse toggleStationStatus(Long id, String performedBy) {
        Station station = stationOperatorAccessService.getAccessibleStation(id, performedBy);
        boolean isActive = Boolean.TRUE.equals(station.getActive());
        if (isActive) {
            List<Long> pointIds = chargingPointRepository.findByStationId(station.getId()).stream()
                    .map(ChargingPoint::getId)
                    .toList();
            if (!pointIds.isEmpty()
                    && chargingSessionRepository.countByChargingPointIdInAndStatus(
                    pointIds, SessionStatus.IN_PROGRESS) > 0) {
                throw new BadRequestException("A station with an active charging session cannot be deactivated");
            }
        }

        // Station availability and connector safety state are separate controls. In
        // particular, never turn OUT_OF_SERVICE or actively charging points back to
        // AVAILABLE as a side effect of reactivating the station.
        station.setActive(!isActive);
        station = stationRepository.save(station);

        String action = station.getActive() ? "ACTIVATE_STATION" : "DEACTIVATE_STATION";
        auditService.log(action, "STATION", station.getId(), performedBy,
                (station.getActive() ? "Activated" : "Deactivated") + " station: " + station.getName());
        return toResponse(station, true);
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

    private StationResponse toResponse(Station station, boolean includeManager) {
        station = referenceResolver.resolveStation(station, station.getId());
        long total = chargingPointRepository.countByStationId(station.getId());
        long available = chargingPointRepository.countByStationIdAndStatus(station.getId(), PointStatus.AVAILABLE);
        return toResponse(station, total, available, includeManager);
    }

    private Page<StationResponse> toResponsePage(Page<Station> stationPage,
                                                  Pageable pageable,
                                                  boolean includeManager) {
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
                            availableCounts.getOrDefault(stationId, 0L),
                            includeManager
                    );
                })
                .toList();
        return new PageImpl<>(content, pageable, stationPage.getTotalElements());
    }

    private StationResponse toResponse(Station station,
                                       long total,
                                       long available,
                                       boolean includeManager) {
        return StationResponse.builder()
                .id(station.getId())
                .name(station.getName())
                .address(station.getAddress())
                .city(station.getCity())
                .state(station.getState())
                .pincode(station.getPincode())
                .contactPhone(station.getContactPhone())
                .contactEmail(station.getContactEmail())
                .managerId(includeManager && station.getManager() != null ? station.getManager().getId() : null)
                .managerName(includeManager && station.getManager() != null ? station.getManager().getFullName() : null)
                .latitude(station.getLatitude())
                .longitude(station.getLongitude())
                .openingTime(station.getOpeningTime())
                .closingTime(station.getClosingTime())
                .active(station.getActive())
                .createdAt(station.getCreatedAt())
                .totalPoints(total)
                .availablePoints(available)
                .localSolarCurrentKw(station.getLocalSolarCurrentKw())
                .localSolarForecastKw(station.getLocalSolarForecastKw())
                .batteryCapacityKwh(station.getBatteryCapacityKwh())
                .batteryStateOfChargePercent(station.getBatteryStateOfChargePercent())
                .gridImportLimitKw(station.getGridImportLimitKw())
                .emergencyReservePercent(station.getEmergencyReservePercent())
                .renewableAvailableForChargingKw(station.getRenewableAvailableForChargingKw())
                .stationUtilizationPercent(station.getStationUtilizationPercent())
                .renewableDataMode(station.getRenewableDataMode())
                .energyUpdatedAt(station.getEnergyUpdatedAt())
                .minimumRatePerKwh(station.getMinimumRatePerKwh())
                .maximumDiscountPercent(station.getMaximumDiscountPercent())
                .build();
    }
}
