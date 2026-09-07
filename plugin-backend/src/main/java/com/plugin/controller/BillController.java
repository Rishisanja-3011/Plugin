package com.plugin.controller;

import com.plugin.dto.response.BillResponse;
import com.plugin.service.BillService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/bills")
@RequiredArgsConstructor
public class BillController {

    private final BillService billService;

    @GetMapping("/my")
    public ResponseEntity<Page<BillResponse>> getMyBills(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication auth) {
        return ResponseEntity.ok(billService.getMyBills(auth.getName(),
                PageRequest.of(safePage(page), safeSize(size))));
    }

    @GetMapping("/my/unpaid-count")
    public ResponseEntity<Map<String, Long>> getMyUnpaidCount(Authentication auth) {
        return ResponseEntity.ok(Map.of("count", billService.getMyUnpaidCount(auth.getName())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BillResponse> getBill(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(billService.getBillForCaller(auth.getName(), id));
    }

    @PostMapping("/my/{id}/wallet-pay")
    public ResponseEntity<BillResponse> payMyBillFromWallet(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(billService.payMyBillFromWallet(auth.getName(), id));
    }

    @GetMapping("/my/{id}/invoice")
    public ResponseEntity<byte[]> downloadMyInvoice(@PathVariable Long id, Authentication auth) {
        BillService.InvoiceFile invoice = billService.getInvoiceForCustomer(auth.getName(), id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + invoice.filename() + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .body(invoice.data());
    }

    @GetMapping("/my/statement")
    public ResponseEntity<byte[]> downloadMyStatement(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {
        BillService.StatementFile statement = billService.getStatementForCustomer(auth.getName(), from, to);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + statement.filename() + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .header("X-Statement-Count", String.valueOf(statement.rowCount()))
                .body(statement.data());
    }

    private int safePage(int page) {
        return Math.max(0, page);
    }

    private int safeSize(int size) {
        return Math.max(1, Math.min(100, size));
    }
}
