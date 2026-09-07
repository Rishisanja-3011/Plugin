package com.plugin.controller;

import com.plugin.dto.request.WalletAutoTopUpRequest;
import com.plugin.dto.request.WalletMandateOrderRequest;
import com.plugin.dto.request.WalletPaymentVerificationRequest;
import com.plugin.dto.request.WalletTopUpOrderRequest;
import com.plugin.dto.request.WalletWithdrawalRequest;
import com.plugin.dto.response.RazorpayOrderResponse;
import com.plugin.dto.response.WalletLedgerEntryResponse;
import com.plugin.dto.response.WalletMandateOrderResponse;
import com.plugin.dto.response.WalletResponse;
import com.plugin.service.WalletService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;

    @GetMapping
    public ResponseEntity<WalletResponse> getWallet(Authentication auth) {
        return ResponseEntity.ok(walletService.getMyWallet(auth.getName()));
    }

    @GetMapping("/ledger")
    public ResponseEntity<Page<WalletLedgerEntryResponse>> getLedger(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {
        return ResponseEntity.ok(walletService.getMyLedger(auth.getName(),
                PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size)))));
    }

    @PostMapping("/withdraw")
    public ResponseEntity<WalletResponse> withdraw(
            @Valid @RequestBody WalletWithdrawalRequest request,
            Authentication auth) {
        return ResponseEntity.ok(walletService.withdrawToOriginalPaymentMethods(auth.getName(), request));
    }

    @PutMapping("/auto-topup")
    public ResponseEntity<WalletResponse> updateAutoTopUp(
            @Valid @RequestBody WalletAutoTopUpRequest request,
            Authentication auth) {
        return ResponseEntity.ok(walletService.updateAutoTopUp(auth.getName(), request));
    }

    @PostMapping("/auto-topup/disable")
    public ResponseEntity<WalletResponse> disableAutoTopUp(Authentication auth) {
        return ResponseEntity.ok(walletService.disableAutoTopUp(auth.getName()));
    }

    @PostMapping("/topup/order")
    public ResponseEntity<RazorpayOrderResponse> createTopUpOrder(
            @Valid @RequestBody WalletTopUpOrderRequest request,
            Authentication auth) {
        return ResponseEntity.ok(walletService.createTopUpOrder(auth.getName(), request));
    }

    @PostMapping("/topup/verify")
    public ResponseEntity<WalletResponse> verifyTopUp(
            @Valid @RequestBody WalletPaymentVerificationRequest request,
            Authentication auth) {
        return ResponseEntity.ok(walletService.verifyTopUp(auth.getName(), request));
    }

    @PostMapping("/mandate/order")
    public ResponseEntity<WalletMandateOrderResponse> createMandateOrder(
            @Valid @RequestBody WalletMandateOrderRequest request,
            Authentication auth) {
        return ResponseEntity.ok(walletService.createMandateOrder(auth.getName(), request));
    }

    @PostMapping("/mandate/verify")
    public ResponseEntity<WalletResponse> verifyMandate(
            @Valid @RequestBody WalletPaymentVerificationRequest request,
            Authentication auth) {
        return ResponseEntity.ok(walletService.verifyMandate(auth.getName(), request));
    }

}
