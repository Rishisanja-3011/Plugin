package com.plugin.controller;

import com.plugin.dto.request.WalletMandateOrderRequest;
import com.plugin.dto.response.WalletResponse;
import com.plugin.service.WalletService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.production", havingValue = "false", matchIfMissing = true)
public class DevelopmentWalletController {

    private final WalletService walletService;

    @PostMapping("/mandate/test-confirm")
    public ResponseEntity<WalletResponse> confirmTestMandate(
            @Valid @RequestBody WalletMandateOrderRequest request,
            Authentication auth) {
        return ResponseEntity.ok(walletService.confirmTestMandate(auth.getName(), request));
    }
}
