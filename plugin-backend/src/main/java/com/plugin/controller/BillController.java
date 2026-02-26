package com.plugin.controller;

import com.plugin.dto.response.BillResponse;
import com.plugin.service.BillService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
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
                PageRequest.of(page, size)));
    }

    @GetMapping("/my/unpaid-count")
    public ResponseEntity<Map<String, Long>> getMyUnpaidCount(Authentication auth) {
        return ResponseEntity.ok(Map.of("count", billService.getMyUnpaidCount(auth.getName())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BillResponse> getBill(@PathVariable Long id) {
        return ResponseEntity.ok(billService.getBillById(id));
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<BillResponse> markAsPaid(@PathVariable Long id) {
        return ResponseEntity.ok(billService.markAsPaid(id));
    }

    @GetMapping("/my/{id}/invoice")
    public ResponseEntity<byte[]> downloadMyInvoice(@PathVariable Long id, Authentication auth) {
        BillService.InvoiceFile invoice = billService.getInvoiceForCustomer(auth.getName(), id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + invoice.filename() + "\"")
                .body(invoice.data());
    }
}
