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
import org.springframework.web.bind.annotation.GetMapping;
import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/optimization")
@RequiredArgsConstructor
public class OptimizationController {
    private final com.plugin.service.StationChargingOptionsService optimizationService;
    private final com.plugin.service.StationRecommendationService stationRecommendationService;
    private final com.plugin.service.RenewableImpactService renewableImpactService;
    private final com.plugin.service.FlexibleChargingService flexibleChargingService;

    @GetMapping("/station-recommendations")
    public ResponseEntity<List<com.plugin.dto.response.EnergyResponses.StationRecommendation>> stationRecommendations(
            Principal principal,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Double latitude,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Double longitude) {
        return ResponseEntity.ok(stationRecommendationService.recommend(principal.getName(), latitude, longitude));
    }

    @PostMapping("/charging-options")
    public ResponseEntity<ChargingOptions> chargingOptions(@Valid @RequestBody ChargingOptionsRequest request) {
        return ResponseEntity.ok(optimizationService.options(request));
    }

    @GetMapping("/my-impact")
    public ResponseEntity<com.plugin.dto.response.RenewableImpactResponse> myImpact(Principal principal) {
        return ResponseEntity.ok(renewableImpactService.customer(principal.getName()));
    }

    @PostMapping("/flexible-plan")
    public ResponseEntity<com.plugin.dto.response.FlexibleChargingPlanResponse> flexiblePlan(
            @Valid @RequestBody com.plugin.dto.request.FlexibleChargingRequest request) {
        return ResponseEntity.ok(flexibleChargingService.plan(request));
    }
}
