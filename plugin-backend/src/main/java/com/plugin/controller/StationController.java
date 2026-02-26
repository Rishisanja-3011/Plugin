package com.plugin.controller;

import com.plugin.dto.response.ChargingPointResponse;
import com.plugin.dto.response.PricingResponse;
import com.plugin.dto.response.StationResponse;
import com.plugin.service.ChargingPointService;
import com.plugin.service.PricingService;
import com.plugin.service.StationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stations")
@RequiredArgsConstructor
public class StationController {

    private final StationService stationService;
    private final ChargingPointService cpService;
    private final PricingService pricingService;

    @GetMapping
    public ResponseEntity<Page<StationResponse>> getActiveStations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(stationService.getActiveStations(
                PageRequest.of(page, size, Sort.by("name"))));
    }

    @GetMapping("/search")
    public ResponseEntity<Page<StationResponse>> searchStations(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(stationService.searchStations(q,
                PageRequest.of(page, size)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StationResponse> getStation(@PathVariable Long id) {
        return ResponseEntity.ok(stationService.getStationById(id));
    }

    @GetMapping("/{id}/charging-points")
    public ResponseEntity<List<ChargingPointResponse>> getChargingPoints(@PathVariable Long id) {
        return ResponseEntity.ok(cpService.getByStation(id));
    }

    @GetMapping("/{id}/pricing")
    public ResponseEntity<List<PricingResponse>> getPricing(@PathVariable Long id) {
        return ResponseEntity.ok(pricingService.getByStation(id));
    }
}
