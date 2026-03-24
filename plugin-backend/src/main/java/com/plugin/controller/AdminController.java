package com.plugin.controller;

import com.plugin.dto.request.AdminBookingCancelRequest;
import com.plugin.dto.request.ChargingPointRequest;
import com.plugin.dto.request.PricingRequest;
import com.plugin.dto.request.StationRequest;
import com.plugin.dto.response.*;
import com.plugin.enums.BookingStatus;
import com.plugin.enums.PointStatus;
import com.plugin.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final StationService stationService;
    private final ChargingPointService cpService;
    private final PricingService pricingService;
    private final BookingService bookingService;
    private final AdminCustomerService adminCustomerService;
    private final SessionService sessionService;
    private final BillService billService;
    private final DashboardService dashboardService;
    private final AuditService auditService;

    // ---- Dashboard ----
    @GetMapping("/dashboard")
    public ResponseEntity<DashboardStats> getDashboard(Authentication auth) {
        return ResponseEntity.ok(dashboardService.getStats(auth.getName()));
    }

    // ---- Stations ----
    @GetMapping("/stations")
    public ResponseEntity<Page<StationResponse>> getAllStations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {
        return ResponseEntity.ok(stationService.getAllStations(
                auth.getName(),
                PageRequest.of(page, size, Sort.by("id"))));
    }

    @PostMapping("/stations")
    public ResponseEntity<StationResponse> createStation(
            @Valid @RequestBody StationRequest request, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(stationService.createStation(request, auth.getName()));
    }

    @PutMapping("/stations/{id}")
    public ResponseEntity<StationResponse> updateStation(
            @PathVariable Long id,
            @Valid @RequestBody StationRequest request,
            Authentication auth) {
        return ResponseEntity.ok(stationService.updateStation(id, request, auth.getName()));
    }

    @PatchMapping("/stations/{id}/toggle")
    public ResponseEntity<StationResponse> toggleStation(
            @PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(stationService.toggleStationStatus(id, auth.getName()));
    }

    @DeleteMapping("/stations/{id}")
    public ResponseEntity<Void> deleteStation(@PathVariable Long id, Authentication auth) {
        stationService.deleteStation(id, auth.getName());
        return ResponseEntity.noContent().build();
    }

    // ---- Charging Points ----
    @GetMapping("/charging-points/station/{stationId}")
    public ResponseEntity<List<ChargingPointResponse>> getChargingPoints(@PathVariable Long stationId, Authentication auth) {
        return ResponseEntity.ok(cpService.getByStation(stationId, auth.getName()));
    }

    @PostMapping("/charging-points")
    public ResponseEntity<ChargingPointResponse> createChargingPoint(
            @Valid @RequestBody ChargingPointRequest request, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(cpService.create(request, auth.getName()));
    }

    @PutMapping("/charging-points/{id}")
    public ResponseEntity<ChargingPointResponse> updateChargingPoint(
            @PathVariable Long id,
            @Valid @RequestBody ChargingPointRequest request,
            Authentication auth) {
        return ResponseEntity.ok(cpService.update(id, request, auth.getName()));
    }

    @PatchMapping("/charging-points/{id}/status")
    public ResponseEntity<ChargingPointResponse> updatePointStatus(
            @PathVariable Long id,
            @RequestParam PointStatus status,
            Authentication auth) {
        return ResponseEntity.ok(cpService.updateStatus(id, status, auth.getName()));
    }

    @DeleteMapping("/charging-points/{id}")
    public ResponseEntity<Void> deleteChargingPoint(@PathVariable Long id, Authentication auth) {
        cpService.delete(id, auth.getName());
        return ResponseEntity.noContent().build();
    }

    // ---- Pricing ----
    @GetMapping("/pricing")
    public ResponseEntity<List<PricingResponse>> getAllPricing(Authentication auth) {
        return ResponseEntity.ok(pricingService.getAll(auth.getName()));
    }

    @GetMapping("/pricing/station/{stationId}")
    public ResponseEntity<List<PricingResponse>> getPricingByStation(@PathVariable Long stationId, Authentication auth) {
        return ResponseEntity.ok(pricingService.getByStation(stationId, auth.getName()));
    }

    @PostMapping("/pricing")
    public ResponseEntity<PricingResponse> createOrUpdatePricing(
            @Valid @RequestBody PricingRequest request, Authentication auth) {
        return ResponseEntity.ok(pricingService.createOrUpdate(request, auth.getName()));
    }

    @DeleteMapping("/pricing/{id}")
    public ResponseEntity<Void> deletePricing(@PathVariable Long id, Authentication auth) {
        pricingService.delete(id, auth.getName());
        return ResponseEntity.noContent().build();
    }

    // ---- Bookings ----
    @GetMapping("/bookings")
    public ResponseEntity<Page<BookingResponse>> getAllBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) BookingStatus status) {
        return ResponseEntity.ok(bookingService.getAllBookings(PageRequest.of(page, size), status));
    }

    @GetMapping("/bookings/stats")
    public ResponseEntity<Map<String, Long>> getBookingStats() {
        return ResponseEntity.ok(bookingService.getBookingStats());
    }

    @GetMapping("/customers")
    public ResponseEntity<Page<AdminCustomerResponse>> getCustomers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Boolean active) {
        return ResponseEntity.ok(adminCustomerService.getCustomers(
                PageRequest.of(page, size, Sort.by("createdAt").descending()),
                name,
                active
        ));
    }

    @PatchMapping("/customers/{id}/status")
    public ResponseEntity<AdminCustomerResponse> updateCustomerStatus(
            @PathVariable Long id,
            @RequestParam boolean active,
            Authentication auth) {
        String actor = auth != null ? auth.getName() : "SYSTEM";
        return ResponseEntity.ok(adminCustomerService.updateCustomerStatus(id, active, actor));
    }

    @GetMapping("/bookings/station/{stationId}")
    public ResponseEntity<Page<BookingResponse>> getBookingsByStation(
            @PathVariable Long stationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(bookingService.getBookingsByStation(stationId,
                PageRequest.of(page, size)));
    }

    @PostMapping("/bookings/{id}/cancel")
    public ResponseEntity<BookingResponse> adminCancelBooking(
            @PathVariable Long id,
            @Valid @RequestBody AdminBookingCancelRequest request,
            Authentication auth) {
        String actor = auth != null ? auth.getName() : "SYSTEM";
        return ResponseEntity.ok(bookingService.cancelBookingAsAdmin(id, actor, request.getReason()));
    }

    @PostMapping("/bookings/{id}/reschedule/approve")
    public ResponseEntity<BookingResponse> approveRescheduleRequest(
            @PathVariable Long id,
            Authentication auth) {
        String actor = auth != null ? auth.getName() : "SYSTEM";
        return ResponseEntity.ok(bookingService.approveRescheduleRequest(id, actor));
    }

    @PostMapping("/bookings/{id}/reschedule/reject")
    public ResponseEntity<BookingResponse> rejectRescheduleRequest(
            @PathVariable Long id,
            Authentication auth) {
        String actor = auth != null ? auth.getName() : "SYSTEM";
        return ResponseEntity.ok(bookingService.rejectRescheduleRequest(id, actor));
    }

    // ---- Sessions ----
    @GetMapping("/sessions")
    public ResponseEntity<Page<SessionResponse>> getAllSessions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(sessionService.getAllSessions(PageRequest.of(page, size)));
    }

    @PostMapping("/sessions/{id}/end")
    public ResponseEntity<SessionResponse> adminEndSession(
            @PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(sessionService.endSession(id, auth.getName()));
    }

    // ---- Bills / Revenue ----
    @GetMapping("/bills")
    public ResponseEntity<Page<BillResponse>> getAllBills(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long stationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ResponseEntity.ok(billService.getAllBills(
                stationId,
                start,
                end,
                PageRequest.of(page, size, Sort.by("createdAt").descending())
        ));
    }

    @PostMapping("/bills/{id}/pay")
    public ResponseEntity<BillResponse> adminMarkPaid(@PathVariable Long id) {
        return ResponseEntity.ok(billService.markAsPaid(id));
    }

    @GetMapping("/bills/{id}/invoice")
    public ResponseEntity<byte[]> downloadInvoice(@PathVariable Long id) {
        BillService.InvoiceFile invoice = billService.getInvoiceForAdmin(id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + invoice.filename() + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .body(invoice.data());
    }

    @GetMapping("/revenue")
    public ResponseEntity<Map<String, Object>> getRevenue(
            @RequestParam(required = false) Long stationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {

        if (start == null) start = LocalDateTime.now().minusYears(1);
        if (end == null) end = LocalDateTime.now().plusDays(1);

        BigDecimal revenue;
        if (stationId != null) {
            revenue = billService.getRevenueByStationInRange(stationId, start, end);
        } else {
            revenue = billService.getRevenueInRange(start, end);
        }
        return ResponseEntity.ok(Map.of("revenue", revenue, "start", start, "end", end));
    }

    // ---- Audit Logs ----
    @GetMapping("/audit-logs")
    public ResponseEntity<Page<AuditLogResponse>> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @RequestParam(required = false) String entityType) {
        if (entityType != null) {
            return ResponseEntity.ok(auditService.getByEntityType(entityType,
                    PageRequest.of(page, size)));
        }
        return ResponseEntity.ok(auditService.getAll(PageRequest.of(page, size)));
    }
}
