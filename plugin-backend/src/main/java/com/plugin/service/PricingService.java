package com.plugin.service;

import com.plugin.dto.request.PricingRequest;
import com.plugin.dto.response.PricingResponse;
import com.plugin.entity.Pricing;
import com.plugin.entity.Station;
import com.plugin.enums.PricingModel;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.PricingRepository;
import com.plugin.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PricingService {

    private final PricingRepository pricingRepository;
    private final StationRepository stationRepository;
    private final ChargingPointRepository chargingPointRepository;
    private final AuditService auditService;

    public List<PricingResponse> getByStation(Long stationId) {
        return pricingRepository.findByStationId(stationId).stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    public List<PricingResponse> getAll() {
        return pricingRepository.findAll().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public PricingResponse createOrUpdate(PricingRequest request, String performedBy) {
        Station station = stationRepository.findById(request.getStationId())
                .orElseThrow(() -> new ResourceNotFoundException("Station not found"));
        if (request.getPricingModel() == PricingModel.PER_MINUTE) {
            throw new BadRequestException("Only PER_KWH pricing is allowed");
        }

        Optional<Pricing> existing = pricingRepository
                .findByStationIdAndPointType(request.getStationId(), request.getPointType());
        if (existing.isEmpty() && chargingPointRepository.countByStationId(request.getStationId()) == 0) {
            throw new BadRequestException("Cannot set pricing for a station with no charging points");
        }
        Pricing pricing = existing.orElse(Pricing.builder()
                .station(station)
                .pointType(request.getPointType())
                .build());

        pricing.setPricingModel(request.getPricingModel());
        pricing.setRatePerUnit(request.getRatePerUnit());
        pricing.setDescription(request.getDescription());
        pricing = pricingRepository.save(pricing);

        auditService.log("UPSERT_PRICING", "PRICING", pricing.getId(), performedBy,
                "Pricing set for station " + station.getName() + " " + request.getPointType() +
                ": " + request.getRatePerUnit() + " " + request.getPricingModel());
        return toResponse(pricing);
    }

    @Transactional
    public void delete(Long id, String performedBy) {
        Pricing pricing = pricingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pricing not found"));
        auditService.log("DELETE_PRICING", "PRICING", id, performedBy, "Deleted pricing record");
        pricingRepository.delete(pricing);
    }

    private PricingResponse toResponse(Pricing p) {
        return PricingResponse.builder()
                .id(p.getId())
                .stationId(p.getStation().getId())
                .stationName(p.getStation().getName())
                .pointType(p.getPointType().name())
                .pricingModel(p.getPricingModel().name())
                .ratePerUnit(p.getRatePerUnit())
                .description(p.getDescription())
                .build();
    }
}
