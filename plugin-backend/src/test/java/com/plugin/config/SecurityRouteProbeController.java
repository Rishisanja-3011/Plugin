package com.plugin.config;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SecurityRouteProbeController {

    @RequestMapping(path = "/api/auth/login", method = {RequestMethod.GET, RequestMethod.POST})
    ResponseEntity<Void> auth() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/station-manager/reference-data", method = RequestMethod.GET)
    ResponseEntity<Void> referenceData() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/station-manager/access/setup", method = RequestMethod.POST)
    ResponseEntity<Void> accessSetup() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/station-manager/status/{id}", method = RequestMethod.GET)
    ResponseEntity<Void> status() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/station-manager/application", method = RequestMethod.POST)
    ResponseEntity<Void> application() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/stations/{id}", method = {RequestMethod.GET, RequestMethod.POST})
    ResponseEntity<Void> station() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = {"/api/bookings/{id}", "/api/sessions/{id}", "/api/bills/{id}", "/api/wallet"},
            method = RequestMethod.GET)
    ResponseEntity<Void> customerResource() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/profile", method = RequestMethod.GET)
    ResponseEntity<Void> profile() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/notifications", method = RequestMethod.GET)
    ResponseEntity<Void> notifications() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/admin/stations", method = RequestMethod.GET)
    ResponseEntity<Void> adminStations() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/admin/station-manager-applications", method = RequestMethod.GET)
    ResponseEntity<Void> adminApplications() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/energy/current", method = {RequestMethod.GET, RequestMethod.POST})
    ResponseEntity<Void> energy() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/optimization/charging-options", method = RequestMethod.POST)
    ResponseEntity<Void> optimization() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/operator/energy/dashboard", method = RequestMethod.GET)
    ResponseEntity<Void> operatorEnergy() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/operator/energy/decisions", method = {RequestMethod.GET, RequestMethod.POST})
    ResponseEntity<Void> operatorEnergyDecisions() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/grid/dashboard", method = RequestMethod.GET)
    ResponseEntity<Void> gridDashboard() { return ResponseEntity.ok().build(); }

    @RequestMapping(path = "/api/grid/signals", method = {RequestMethod.GET, RequestMethod.POST})
    ResponseEntity<Void> gridSignals() { return ResponseEntity.ok().build(); }
}
