package com.plugin.service;

import com.plugin.dto.request.WalletPaymentVerificationRequest;
import com.plugin.entity.ChargingSession;
import com.plugin.entity.User;
import com.plugin.entity.Wallet;
import com.plugin.entity.WalletTopUpAttempt;
import com.plugin.enums.WalletTransactionStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.ChargingSessionRepository;
import com.plugin.repository.UserRepository;
import com.plugin.repository.WalletLedgerEntryRepository;
import com.plugin.repository.WalletRepository;
import com.plugin.repository.WalletTopUpAttemptRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WalletServiceSecurityTest {

    @Mock private WalletRepository walletRepository;
    @Mock private WalletLedgerEntryRepository ledgerRepository;
    @Mock private WalletTopUpAttemptRepository topUpAttemptRepository;
    @Mock private UserRepository userRepository;
    @Mock private RazorpayPaymentService razorpayPaymentService;
    @Mock private NotificationService notificationService;
    @Mock private ChargingSessionRepository sessionRepository;
    @Mock private AuditService auditService;

    @InjectMocks private WalletService walletService;

    @Test
    void liveDebitPersistsSessionCursorWithWalletAndLedgerWrites() {
        User customer = User.builder().id(81L).email("wallet@example.com").build();
        Wallet wallet = Wallet.builder()
                .id(82L)
                .customerId(customer.getId())
                .balance(new BigDecimal("100.00"))
                .autoTopUpEnabled(false)
                .build();
        ChargingSession session = ChargingSession.builder()
                .id(83L)
                .customer(customer)
                .walletDebitedAmount(BigDecimal.ZERO)
                .build();
        when(walletRepository.findByCustomerId(customer.getId())).thenReturn(Optional.of(wallet));
        when(walletRepository.save(any(Wallet.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WalletService.WalletSessionMonitorResult result =
                walletService.applyLiveSessionDebit(session, new BigDecimal("25.00"));

        assertFalse(result.shouldStop());
        assertEquals(new BigDecimal("25.00"), result.walletDebitedAmount());
        assertEquals(new BigDecimal("75.00"), result.balanceAfter());
        assertEquals(new BigDecimal("25.00"), session.getWalletDebitedAmount());

        InOrder writes = inOrder(walletRepository, ledgerRepository, sessionRepository);
        writes.verify(walletRepository).save(wallet);
        writes.verify(ledgerRepository).save(any());
        writes.verify(sessionRepository).save(session);
        verify(auditService).log(
                "DEBIT_WALLET", "WALLET", wallet.getId(), customer.getEmail(),
                "Debited Rs. 25.00; reference=CHARGING_SESSION:83");
    }

    @Test
    void rejectsSignedTopUpWhenProviderDoesNotConfirmCapturedSettlement() {
        User customer = User.builder().id(91L).email("topup@example.com").build();
        WalletTopUpAttempt attempt = WalletTopUpAttempt.builder()
                .id(92L)
                .customerId(customer.getId())
                .amount(new BigDecimal("1000.00"))
                .status(WalletTransactionStatus.PENDING)
                .razorpayOrderId("order_92")
                .build();
        WalletPaymentVerificationRequest request = new WalletPaymentVerificationRequest();
        request.setRazorpayOrderId("order_92");
        request.setRazorpayPaymentId("pay_92");
        request.setRazorpaySignature("signature");

        when(userRepository.findByEmail(customer.getEmail())).thenReturn(Optional.of(customer));
        when(razorpayPaymentService.verifyPaymentSignature("order_92", "pay_92", "signature"))
                .thenReturn(true);
        when(topUpAttemptRepository.findByRazorpayOrderId("order_92")).thenReturn(Optional.of(attempt));
        org.mockito.Mockito.doThrow(new BadRequestException("Payment is not captured."))
                .when(razorpayPaymentService)
                .requireCapturedPayment("order_92", "pay_92", new BigDecimal("1000.00"));

        assertThrows(BadRequestException.class,
                () -> walletService.verifyTopUp(customer.getEmail(), request));

        verify(walletRepository, never()).save(any());
        verify(ledgerRepository, never()).save(any());
        verify(topUpAttemptRepository, never()).save(any());
    }

    @Test
    void productionModeDisablesTestMandateFallback() {
        ReflectionTestUtils.setField(walletService, "productionMode", true);

        BadRequestException exception = assertThrows(BadRequestException.class,
                () -> walletService.confirmTestMandate("customer@example.com", null));

        assertEquals("Test mandate fallback is disabled in production.", exception.getMessage());
        verify(razorpayPaymentService, never()).isTestMode();
        verifyNoUserOrWalletWrites();
    }

    private void verifyNoUserOrWalletWrites() {
        verify(userRepository, never()).findByEmail(any());
        verify(walletRepository, never()).save(any());
    }
}
