package com.plugin.controller;

import com.plugin.dto.response.EnergyResponses.GridPoint;
import com.plugin.service.RenewableEnergyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/energy")
@RequiredArgsConstructor
public class EnergyController {
    private final RenewableEnergyService energyService;

    @GetMapping("/current")
    public ResponseEntity<GridPoint> current(@RequestParam(required = false) String region) {
        return ResponseEntity.ok(energyService.current(region));
    }

    @GetMapping("/forecast")
    public ResponseEntity<List<GridPoint>> forecast(@RequestParam(required = false) String region,
                                                     @RequestParam(defaultValue = "24") int hours) {
        return ResponseEntity.ok(energyService.forecast(region, hours));
    }
}
