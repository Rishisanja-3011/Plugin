package com.plugin.controller;

import com.plugin.dto.request.ChargingOptionsRequest;
import com.plugin.dto.response.EnergyResponses.ChargingOptions;
import com.plugin.service.ChargingOptimizationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/optimization")
@RequiredArgsConstructor
public class OptimizationController {
    private final com.plugin.service.StationChargingOptionsService optimizationService;

    @PostMapping("/charging-options")
    public ResponseEntity<ChargingOptions> chargingOptions(@Valid @RequestBody ChargingOptionsRequest request) {
        return ResponseEntity.ok(optimizationService.options(request));
    }
}
