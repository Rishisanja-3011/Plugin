package com.plugin.controller;

import com.plugin.dto.request.StationManagerAccessSetupRequest;
import com.plugin.service.StationManagerAccessSetupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/station-manager/access")
@RequiredArgsConstructor
public class StationManagerAccessSetupController {

    private final StationManagerAccessSetupService accessSetupService;

    @PostMapping("/setup")
    public ResponseEntity<Map<String, String>> setupAccess(
            @Valid @RequestBody StationManagerAccessSetupRequest request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(accessSetupService.completeSetup(request));
    }
}
