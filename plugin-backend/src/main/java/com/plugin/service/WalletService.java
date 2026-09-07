package com.plugin.service;

import com.plugin.dto.request.WalletAutoTopUpRequest;
import com.plugin.dto.request.WalletMandateOrderRequest;
import com.plugin.dto.request.WalletPaymentVerificationRequest;
import com.plugin.dto.request.WalletTopUpOrderRequest;
import com.plugin.dto.request.WalletWithdrawalRequest;
import com.plugin.dto.response.RazorpayOrderResponse;
import com.plugin.dto.response.WalletLedgerEntryResponse;
import com.plugin.dto.response.WalletMandateOrderResponse;
import com.plugin.dto.response.WalletResponse;
import com.plugin.entity.ChargingSession;
import com.plugin.entity.User;
import com.plugin.entity.Wallet;
import com.plugin.entity.WalletLedgerEntry;
import com.plugin.entity.WalletTopUpAttempt;
import com.plugin.enums.WalletLedgerType;
import com.plugin.enums.WalletTransactionStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.UserRepository;
import com.plugin.repository.ChargingSessionRepository;
import com.plugin.repository.WalletLedgerEntryRepository;
import com.plugin.repository.WalletRepository;
import com.plugin.repository.WalletTopUpAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class WalletService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    private static final BigDecimal DEFAULT_THRESHOLD = BigDecimal.valueOf(200).setScale(2, RoundingMode.HALF_UP);
    private static final BigDecimal DEFAULT_TOP_UP = BigDecimal.valueOf(1000).setScale(2, RoundingMode.HALF_UP);
    private static final BigDecimal MIN_TOP_UP = BigDecimal.valueOf(1000).setScale(2, RoundingMode.HALF_UP);
    private static final BigDecimal MAX_AUTO_DEBIT = BigDecimal.valueOf(15000).setScale(2, RoundingMode.HALF_UP);

    private final WalletRepository walletRepository;
    private final WalletLedgerEntryRepository ledgerRepository;
    private final WalletTopUpAttemptRepository topUpAttemptRepository;
    private final UserRepository userRepository;
    private final RazorpayPaymentService razorpayPaymentService;
    private final NotificationService notificationService;
    private final ChargingSessionRepository sessionRepository;
    private final AuditService auditService;

    private final Object walletLock = new Object();

    @Value("${app.production:false}")
    private boolean productionMode;

    public record WalletSessionMonitorResult(boolean shouldStop,
                                             String reason,
                                             BigDecimal walletDebitedAmount,
                                             BigDecimal balanceAfter) {}

    public record WalletSettlementResult(boolean paid,
                                         String reason,
                                         BigDecimal walletDebitedAmount,
                                         BigDecimal balanceAfter) {}

    @Transactional
    public WalletResponse getMyWallet(String email) {
        User user = findUser(email);
        return toResponse(getOrCreateWallet(user));
    }

    @Transactional
    public Page<WalletLedgerEntryResponse> getMyLedger(String email, Pageable pageable) {
        User user = findUser(email);
        return ledgerRepository.findByCustomerIdOrderByCreatedAtDesc(user.getId(), pageable)
                .map(this::toLedgerResponse);
    }

    @Transactional
    public WalletResponse withdrawToOriginalPaymentMethods(String email, WalletWithdrawalRequest request) {
        User user = findUser(email);
        BigDecimal requestedAmount = normalizeWithdrawalAmount(request.getAmount());

        synchronized (walletLock) {
            Wallet wallet = getOrCreateWallet(user);
            BigDecimal balance = normalizeMoney(wallet.getBalance());
            if (balance.compareTo(requestedAmount) < 0) {
                throw new BadRequestException("Wallet balance is not enough for this withdrawal.");
            }

            BigDecimal withdrawable = calculateWithdrawableBalance(user, wallet);
            if (withdrawable.compareTo(requestedAmount) < 0) {
                throw new BadRequestException("Only Rs. " + withdrawable.toPlainString()
                        + " can be withdrawn to original payment methods.");
            }

            BigDecimal remaining = requestedAmount;
            List<WalletTopUpAttempt> sources = refundableTopUps(user.getId());
            for (WalletTopUpAttempt source : sources) {
                if (remaining.compareTo(ZERO) <= 0) {
                    break;
                }
                BigDecimal refundable = refundableAmount(source);
                if (refundable.compareTo(ZERO) <= 0) {
                    continue;
                }
                BigDecimal refundAmount = remaining.min(refundable).setScale(2, RoundingMode.HALF_UP);
                RazorpayPaymentService.RefundResult refund = razorpayPaymentService.refundPayment(
                        source.getRazorpayPaymentId(),
                        refundAmount,
                        "wallet_refund_" + source.getId() + "_" + System.currentTimeMillis()
                );
                source.setRefundedAmount(normalizeMoney(source.getRefundedAmount()).add(refundAmount).setScale(2, RoundingMode.HALF_UP));
                source.setLastRefundedAt(LocalDateTime.now());
                List<String> refundIds = source.getRazorpayRefundIds() != null
                        ? new ArrayList<>(source.getRazorpayRefundIds())
                        : new ArrayList<>();
                refundIds.add(refund.refundId());
                source.setRazorpayRefundIds(refundIds);
                topUpAttemptRepository.save(source);

                wallet = debitWithdrawal(wallet, user, refundAmount, source, refund);
                remaining = remaining.subtract(refundAmount).setScale(2, RoundingMode.HALF_UP);
            }

            if (remaining.compareTo(ZERO) > 0) {
                throw new BadRequestException("Withdrawal could not be fully matched to original top-up sources.");
            }
            notificationService.send(user.getId(), "Wallet withdrawal requested",
                    "Rs. " + requestedAmount.toPlainString()
                            + " will be refunded to your original payment method in 5-7 business days.");
            return toResponse(wallet);
        }
    }

    @Transactional
    public WalletResponse updateAutoTopUp(String email, WalletAutoTopUpRequest request) {
        User user = findUser(email);
        synchronized (walletLock) {
            Wallet wallet = getOrCreateWallet(user);
            wallet.setAutoTopUpThreshold(normalizePositive(request.getThresholdAmount()));
            wallet.setAutoTopUpAmount(normalizeTopUpAmount(request.getTopUpAmount()));
            wallet.setMaxAutoDebitAmount(MAX_AUTO_DEBIT);
            if (request.isEnabled() && !hasConfirmedMandate(wallet)) {
                throw new BadRequestException("Set up a Razorpay mandate before enabling Auto-Top-Up.");
            }
            wallet.setAutoTopUpEnabled(request.isEnabled());
            wallet = walletRepository.save(wallet);
            auditService.log("UPDATE_AUTO_TOP_UP", "WALLET", wallet.getId(), user.getEmail(),
                    "Auto top-up set to " + (request.isEnabled() ? "ENABLED" : "DISABLED"));
            return toResponse(wallet);
        }
    }

    @Transactional
    public WalletResponse disableAutoTopUp(String email) {
        User user = findUser(email);
        Wallet wallet = getOrCreateWallet(user);
        wallet.setAutoTopUpEnabled(false);
        wallet = walletRepository.save(wallet);
        auditService.log("DISABLE_AUTO_TOP_UP", "WALLET", wallet.getId(), user.getEmail(),
                "Auto top-up disabled");
        return toResponse(wallet);
    }

    @Transactional
    public RazorpayOrderResponse createTopUpOrder(String email, WalletTopUpOrderRequest request) {
        User user = findUser(email);
        Wallet wallet = getOrCreateWallet(user);
        BigDecimal amount = normalizeTopUpAmount(request.getAmount());
        String receipt = "wallet_" + wallet.getId() + "_" + System.currentTimeMillis();
        RazorpayPaymentService.CreatedOrder order = razorpayPaymentService.createWalletTopUpOrder(wallet.getId(), amount, receipt);
        WalletTopUpAttempt attempt = WalletTopUpAttempt.builder()
                .walletId(wallet.getId())
                .customerId(user.getId())
                .triggerReason("MANUAL")
                .amount(amount)
                .status(WalletTransactionStatus.PENDING)
                .razorpayOrderId(order.orderId())
                .build();
        topUpAttemptRepository.save(attempt);
        auditService.log("CREATE_WALLET_TOP_UP_ORDER", "WALLET", wallet.getId(), user.getEmail(),
                "Created top-up order for Rs. " + amount.toPlainString()
                        + "; providerOrderId=" + order.orderId());
        return RazorpayOrderResponse.builder()
                .billId(null)
                .keyId(razorpayPaymentService.getKeyId())
                .orderId(order.orderId())
                .amountInPaise(order.amountInPaise())
                .amount(amount)
                .currency(order.currency())
                .receipt(order.receipt())
                .name(razorpayPaymentService.getBusinessName())
                .description("PLUGIN wallet top-up")
                .customerName(user.getFullName())
                .customerEmail(user.getEmail())
                .customerContact(user.getPhone())
                .build();
    }

    @Transactional
    public WalletResponse verifyTopUp(String email, WalletPaymentVerificationRequest request) {
        User user = findUser(email);
        if (!razorpayPaymentService.verifyPaymentSignature(
                request.getRazorpayOrderId(),
                request.getRazorpayPaymentId(),
                request.getRazorpaySignature())) {
            throw new BadRequestException("Wallet top-up verification failed.");
        }

        synchronized (walletLock) {
            WalletTopUpAttempt attempt = topUpAttemptRepository.findByRazorpayOrderId(request.getRazorpayOrderId())
                    .orElseThrow(() -> new ResourceNotFoundException("Wallet top-up attempt not found"));
            if (!attempt.getCustomerId().equals(user.getId())) {
                throw new BadRequestException("Wallet top-up does not belong to this account.");
            }
            razorpayPaymentService.requireCapturedPayment(
                    request.getRazorpayOrderId(),
                    request.getRazorpayPaymentId(),
                    attempt.getAmount());
            Wallet wallet = getOrCreateWallet(user);
            if (attempt.getStatus() == WalletTransactionStatus.SUCCEEDED) {
                return toResponse(wallet);
            }

            wallet = credit(wallet, user, attempt.getAmount(), WalletLedgerType.MANUAL_TOP_UP,
                    "WALLET_TOP_UP", String.valueOf(attempt.getId()), request.getRazorpayOrderId(),
                    request.getRazorpayPaymentId(), "Manual wallet top-up");

            attempt.setStatus(WalletTransactionStatus.SUCCEEDED);
            attempt.setRazorpayPaymentId(request.getRazorpayPaymentId());
            attempt.setCompletedAt(LocalDateTime.now());
            topUpAttemptRepository.save(attempt);
            return toResponse(wallet);
        }
    }

    @Transactional
    public WalletMandateOrderResponse createMandateOrder(String email, WalletMandateOrderRequest request) {
        User user = findUser(email);
        synchronized (walletLock) {
            Wallet wallet = getOrCreateWallet(user);
            wallet.setAutoTopUpThreshold(normalizePositive(request.getThresholdAmount()));
            wallet.setAutoTopUpAmount(normalizeTopUpAmount(request.getTopUpAmount()));
            wallet.setMaxAutoDebitAmount(MAX_AUTO_DEBIT);
            if (isBlank(wallet.getRazorpayCustomerId())) {
                wallet.setRazorpayCustomerId(razorpayPaymentService.createCustomer(user));
            }
            String method = normalizeMandateMethod(request.getMethod());
            String receipt = "mandate_" + wallet.getId() + "_" + System.currentTimeMillis();
            RazorpayPaymentService.CreatedOrder order = razorpayPaymentService.createRecurringAuthorizationOrder(
                    user,
                    wallet.getRazorpayCustomerId(),
                    method,
                    wallet.getMaxAutoDebitAmount(),
                    receipt
            );
            wallet.setMandateMethod(method);
            wallet.setMandateStatus("INITIATED");
            wallet.setMandateOrderId(order.orderId());
            wallet.setMandatePaymentId(null);
            wallet.setMandateFailureReason(null);
            wallet = walletRepository.save(wallet);
            auditService.log("CREATE_WALLET_MANDATE", "WALLET", wallet.getId(), user.getEmail(),
                    "Created recurring authorization; providerOrderId=" + order.orderId());
            return WalletMandateOrderResponse.builder()
                    .walletId(wallet.getId())
                    .keyId(razorpayPaymentService.getKeyId())
                    .orderId(order.orderId())
                    .customerId(wallet.getRazorpayCustomerId())
                    .amountInPaise(order.amountInPaise())
                    .amount(BigDecimal.ONE.setScale(2, RoundingMode.HALF_UP))
                    .currency(order.currency())
                    .method(method)
                    .name(razorpayPaymentService.getBusinessName())
                    .description("Authorize PLUGIN wallet Auto-Top-Up")
                    .customerName(user.getFullName())
                    .customerEmail(user.getEmail())
                    .customerContact(user.getPhone())
                    .recurring(true)
                    .build();
        }
    }

    @Transactional
    public WalletResponse verifyMandate(String email, WalletPaymentVerificationRequest request) {
        User user = findUser(email);
        if (!razorpayPaymentService.verifyPaymentSignature(
                request.getRazorpayOrderId(),
                request.getRazorpayPaymentId(),
                request.getRazorpaySignature())) {
            throw new BadRequestException("Auto-Top-Up mandate verification failed.");
        }

        synchronized (walletLock) {
            Wallet wallet = getOrCreateWallet(user);
            if (!request.getRazorpayOrderId().equals(wallet.getMandateOrderId())) {
                throw new BadRequestException("Mandate order does not match this wallet.");
            }
            RazorpayPaymentService.PaymentMethodSummary summary =
                    razorpayPaymentService.fetchPaymentMethodSummary(request.getRazorpayPaymentId());
            if (!("authorized".equalsIgnoreCase(summary.status())
                    || "captured".equalsIgnoreCase(summary.status()))) {
                throw new BadRequestException("Razorpay mandate authorization is not active.");
            }
            if (!isBlank(summary.customerId())
                    && !summary.customerId().equals(wallet.getRazorpayCustomerId())) {
                throw new BadRequestException("Razorpay mandate customer does not match this wallet.");
            }
            wallet.setRazorpayTokenId(summary.tokenId());
            wallet.setMandateMethod(summary.method() != null ? summary.method() : wallet.getMandateMethod());
            wallet.setMandateStatus("CONFIRMED");
            wallet.setMandateFailureReason(summary.failureReason());
            wallet.setMandatePaymentId(request.getRazorpayPaymentId());
            wallet.setPaymentMethodLabel(summary.label());
            wallet.setPaymentMethodLast4(summary.last4());
            wallet.setPaymentMethodNetwork(summary.network());
            wallet.setMandateConfirmedAt(LocalDateTime.now());
            wallet.setAutoTopUpEnabled(true);
            wallet = walletRepository.save(wallet);
            auditService.log("CONFIRM_WALLET_MANDATE", "WALLET", wallet.getId(), user.getEmail(),
                    "Confirmed recurring authorization; providerPaymentId="
                            + request.getRazorpayPaymentId());
            return toResponse(wallet);
        }
    }

    @Transactional
    public WalletResponse confirmTestMandate(String email, WalletMandateOrderRequest request) {
        if (productionMode) {
            throw new BadRequestException("Test mandate fallback is disabled in production.");
        }
        if (!razorpayPaymentService.isTestMode()) {
            throw new BadRequestException("Test mandate fallback is available only with Razorpay test keys.");
        }
        User user = findUser(email);
        synchronized (walletLock) {
            Wallet wallet = getOrCreateWallet(user);
            wallet.setAutoTopUpThreshold(normalizePositive(request.getThresholdAmount()));
            wallet.setAutoTopUpAmount(normalizeTopUpAmount(request.getTopUpAmount()));
            wallet.setMaxAutoDebitAmount(MAX_AUTO_DEBIT);
            if (isBlank(wallet.getRazorpayCustomerId())) {
                wallet.setRazorpayCustomerId("test_customer_" + user.getId());
            }
            wallet.setRazorpayTokenId("test_mandate_" + wallet.getId() + "_" + System.currentTimeMillis());
            wallet.setMandateMethod(normalizeMandateMethod(request.getMethod()));
            wallet.setMandateStatus("CONFIRMED");
            wallet.setMandateFailureReason(null);
            wallet.setPaymentMethodLabel("Razorpay test mandate");
            wallet.setPaymentMethodLast4(null);
            wallet.setPaymentMethodNetwork("TEST");
            wallet.setMandateConfirmedAt(LocalDateTime.now());
            wallet.setAutoTopUpEnabled(true);
            wallet = walletRepository.save(wallet);
            auditService.log("CONFIRM_TEST_WALLET_MANDATE", "WALLET", wallet.getId(), user.getEmail(),
                    "Confirmed development-only recurring authorization");
            return toResponse(wallet);
        }
    }

    @Transactional
    public void ensureReadyForSessionStart(User user) {
        synchronized (walletLock) {
            Wallet wallet = getOrCreateWallet(user);
            if (wallet.getBalance().compareTo(threshold(wallet)) < 0 && wallet.isAutoTopUpEnabled()) {
                Wallet refreshed = performAutoTopUp(wallet, user, "PRE_CHARGE_CHECK");
                if (refreshed.getBalance().compareTo(threshold(refreshed)) < 0) {
                    throw new BadRequestException("Auto-Top-Up could not secure enough wallet balance to start charging.");
                }
                return;
            }
            if (wallet.getBalance().compareTo(ZERO) <= 0) {
                throw new BadRequestException("Add wallet balance or enable Auto-Top-Up before starting charging.");
            }
        }
    }

    @Transactional
    public WalletSessionMonitorResult applyLiveSessionDebit(ChargingSession session, BigDecimal estimatedCost) {
        if (session == null || session.getCustomer() == null || session.getId() == null) {
            return new WalletSessionMonitorResult(false, null, ZERO, null);
        }

        synchronized (walletLock) {
            User user = session.getCustomer();
            Wallet wallet = getOrCreateWallet(user);
            BigDecimal targetCost = normalizeMoney(estimatedCost);
            BigDecimal alreadyDebited = normalizeMoney(session.getWalletDebitedAmount());
            BigDecimal delta = targetCost.subtract(alreadyDebited).setScale(2, RoundingMode.HALF_UP);
            if (delta.compareTo(ZERO) <= 0) {
                return persistMonitorResult(session, false, null, alreadyDebited, wallet.getBalance());
            }

            DebitOutcome firstDebit = debitAvailable(wallet, user, delta, session);
            wallet = firstDebit.wallet();
            alreadyDebited = alreadyDebited.add(firstDebit.debited()).setScale(2, RoundingMode.HALF_UP);
            delta = delta.subtract(firstDebit.debited()).setScale(2, RoundingMode.HALF_UP);

            if (delta.compareTo(ZERO) <= 0) {
                return persistMonitorResult(session, false, null, alreadyDebited, wallet.getBalance());
            }

            if (!wallet.isAutoTopUpEnabled() || !hasConfirmedMandate(wallet)) {
                return persistMonitorResult(session, true,
                        "Wallet reached zero and Auto-Top-Up is not ready.",
                        alreadyDebited,
                        wallet.getBalance());
            }

            wallet = performAutoTopUp(wallet, user, "MID_CHARGE_RESCUE");
            DebitOutcome rescueDebit = debitAvailable(wallet, user, delta, session);
            wallet = rescueDebit.wallet();
            alreadyDebited = alreadyDebited.add(rescueDebit.debited()).setScale(2, RoundingMode.HALF_UP);
            delta = delta.subtract(rescueDebit.debited()).setScale(2, RoundingMode.HALF_UP);

            if (delta.compareTo(ZERO) > 0) {
                return persistMonitorResult(session, true,
                        "Auto-Top-Up failed or did not secure enough funds.",
                        alreadyDebited,
                        wallet.getBalance());
            }
            return persistMonitorResult(session, false, null, alreadyDebited, wallet.getBalance());
        }
    }

    private WalletSessionMonitorResult persistMonitorResult(ChargingSession session,
                                                             boolean shouldStop,
                                                             String reason,
                                                             BigDecimal debited,
                                                             BigDecimal balanceAfter) {
        session.setWalletDebitedAmount(normalizeMoney(debited));
        session.setWalletBalanceAfterLastDebit(balanceAfter != null ? normalizeMoney(balanceAfter) : null);
        session.setWalletLastCheckedAt(LocalDateTime.now());
        sessionRepository.save(session);
        return new WalletSessionMonitorResult(shouldStop, reason,
                normalizeMoney(debited), balanceAfter != null ? normalizeMoney(balanceAfter) : null);
    }

    @Transactional
    public WalletSettlementResult settleCompletedSession(ChargingSession session, BigDecimal finalAmount, String invoiceNumber) {
        if (session == null || session.getCustomer() == null) {
            return new WalletSettlementResult(false, "No customer wallet found for this session.", ZERO, null);
        }

        synchronized (walletLock) {
            User user = session.getCustomer();
            Wallet wallet = getOrCreateWallet(user);
            BigDecimal finalCost = normalizeMoney(finalAmount);
            BigDecimal alreadyDebited = normalizeMoney(session.getWalletDebitedAmount());
            BigDecimal remaining = finalCost.subtract(alreadyDebited).setScale(2, RoundingMode.HALF_UP);
            if (remaining.compareTo(ZERO) <= 0) {
                return new WalletSettlementResult(true, null, alreadyDebited, wallet.getBalance());
            }

            DebitOutcome firstDebit = debitAvailable(wallet, user, remaining, session);
            wallet = firstDebit.wallet();
            alreadyDebited = alreadyDebited.add(firstDebit.debited()).setScale(2, RoundingMode.HALF_UP);
            remaining = remaining.subtract(firstDebit.debited()).setScale(2, RoundingMode.HALF_UP);

            if (remaining.compareTo(ZERO) <= 0) {
                return new WalletSettlementResult(true, null, alreadyDebited, wallet.getBalance());
            }

            if (wallet.isAutoTopUpEnabled() && hasConfirmedMandate(wallet)) {
                wallet = performAutoTopUp(wallet, user, "FINAL_SESSION_SETTLEMENT");
                DebitOutcome finalDebit = debitAvailable(wallet, user, remaining, session);
                wallet = finalDebit.wallet();
                alreadyDebited = alreadyDebited.add(finalDebit.debited()).setScale(2, RoundingMode.HALF_UP);
                remaining = remaining.subtract(finalDebit.debited()).setScale(2, RoundingMode.HALF_UP);
            }

            if (remaining.compareTo(ZERO) > 0) {
                return new WalletSettlementResult(false,
                        "Wallet could not cover invoice " + invoiceNumber + ".",
                        alreadyDebited,
                        wallet.getBalance());
            }
            return new WalletSettlementResult(true, null, alreadyDebited, wallet.getBalance());
        }
    }

    @Transactional
    public WalletSettlementResult settleBill(User user, Long billId, BigDecimal amount, String invoiceNumber) {
        if (user == null || billId == null) {
            return new WalletSettlementResult(false, "No customer wallet found for this invoice.", ZERO, null);
        }

        synchronized (walletLock) {
            Wallet wallet = getOrCreateWallet(user);
            BigDecimal payableAmount = normalizeMoney(amount);
            String referenceId = String.valueOf(billId);
            String description = invoiceNumber != null && !invoiceNumber.isBlank()
                    ? "Invoice wallet payment " + invoiceNumber
                    : "Invoice wallet payment";

            if (payableAmount.compareTo(ZERO) <= 0) {
                return new WalletSettlementResult(false, "Invoice amount must be greater than zero.", ZERO, wallet.getBalance());
            }

            if (normalizeMoney(wallet.getBalance()).compareTo(payableAmount) < 0
                    && wallet.isAutoTopUpEnabled()
                    && hasConfirmedMandate(wallet)) {
                wallet = performAutoTopUp(wallet, user, "INVOICE_WALLET_PAYMENT");
            }

            if (normalizeMoney(wallet.getBalance()).compareTo(payableAmount) < 0) {
                return new WalletSettlementResult(false,
                        "Wallet balance is not enough for this invoice. Add wallet balance or enable Auto-Top-Up.",
                        ZERO,
                        wallet.getBalance());
            }

            DebitOutcome debit = debitAvailable(wallet, user, payableAmount, "BILL", referenceId, description);
            wallet = debit.wallet();
            return new WalletSettlementResult(true, null, debit.debited(), wallet.getBalance());
        }
    }

    private Wallet performAutoTopUp(Wallet wallet, User user, String triggerReason) {
        if (!wallet.isAutoTopUpEnabled() || !hasConfirmedMandate(wallet)) {
            return wallet;
        }
        BigDecimal amount = normalizeTopUpAmount(wallet.getAutoTopUpAmount());
        WalletTopUpAttempt attempt = WalletTopUpAttempt.builder()
                .walletId(wallet.getId())
                .customerId(user.getId())
                .triggerReason(triggerReason)
                .amount(amount)
                .status(WalletTransactionStatus.PENDING)
                .build();
        attempt = topUpAttemptRepository.save(attempt);
        try {
            if (isTestSandboxMandate(wallet)) {
                attempt.setRazorpayOrderId("test_order_" + attempt.getId());
                attempt.setRazorpayPaymentId("test_autopay_" + attempt.getId());
                attempt.setStatus(WalletTransactionStatus.SUCCEEDED);
                attempt.setCompletedAt(LocalDateTime.now());
                topUpAttemptRepository.save(attempt);
                wallet = credit(wallet, user, amount, WalletLedgerType.AUTO_TOP_UP,
                        "AUTO_TOP_UP", String.valueOf(attempt.getId()), attempt.getRazorpayOrderId(),
                        attempt.getRazorpayPaymentId(), "Test Auto-Top-Up triggered by " + triggerReason);
                wallet.setLastAutoTopUpAt(LocalDateTime.now());
                wallet.setMandateFailureReason(null);
                notificationService.send(user.getId(), "Wallet topped up",
                        "Test Auto-Top-Up added Rs. " + amount.toPlainString() + " to your PLUGIN wallet.");
                return walletRepository.save(wallet);
            }

            RazorpayPaymentService.RecurringPaymentResult result = razorpayPaymentService.chargeRecurringPayment(
                    user,
                    wallet.getRazorpayCustomerId(),
                    wallet.getRazorpayTokenId(),
                    amount,
                    "autotop_" + attempt.getId(),
                    "PLUGIN wallet Auto-Top-Up"
            );
            attempt.setRazorpayOrderId(result.orderId());
            attempt.setRazorpayPaymentId(result.paymentId());
            if (!result.fundsSecured()) {
                attempt.setStatus(WalletTransactionStatus.FAILED);
                attempt.setFailureReason(result.failureReason());
                attempt.setCompletedAt(LocalDateTime.now());
                topUpAttemptRepository.save(attempt);
                wallet.setMandateFailureReason(result.failureReason());
                return walletRepository.save(wallet);
            }
            attempt.setStatus(WalletTransactionStatus.SUCCEEDED);
            attempt.setCompletedAt(LocalDateTime.now());
            topUpAttemptRepository.save(attempt);
            wallet = credit(wallet, user, amount, WalletLedgerType.AUTO_TOP_UP,
                    "AUTO_TOP_UP", String.valueOf(attempt.getId()), result.orderId(), result.paymentId(),
                    "Auto-Top-Up triggered by " + triggerReason);
            wallet.setLastAutoTopUpAt(LocalDateTime.now());
            wallet.setMandateFailureReason(null);
            notificationService.send(user.getId(), "Wallet topped up",
                    "Auto-Top-Up added Rs. " + amount.toPlainString() + " to your PLUGIN wallet.");
            return walletRepository.save(wallet);
        } catch (Exception ex) {
            log.warn("Auto top-up failed for wallet {}; type={}",
                    wallet.getId(), ex.getClass().getName());
            String safeFailure = "Auto top-up failed. Please retry or contact support.";
            attempt.setStatus(WalletTransactionStatus.FAILED);
            attempt.setFailureReason(safeFailure);
            attempt.setCompletedAt(LocalDateTime.now());
            topUpAttemptRepository.save(attempt);
            wallet.setMandateFailureReason(safeFailure);
            return walletRepository.save(wallet);
        }
    }

    private Wallet getOrCreateWallet(User user) {
        return walletRepository.findByCustomerId(user.getId())
                .orElseGet(() -> walletRepository.save(Wallet.builder()
                        .customerId(user.getId())
                        .balance(ZERO)
                        .autoTopUpEnabled(false)
                        .autoTopUpThreshold(DEFAULT_THRESHOLD)
                        .autoTopUpAmount(DEFAULT_TOP_UP)
                        .maxAutoDebitAmount(MAX_AUTO_DEBIT)
                        .mandateStatus("NOT_CONFIGURED")
                        .build()));
    }

    private Wallet credit(Wallet wallet,
                          User user,
                          BigDecimal amount,
                          WalletLedgerType type,
                          String referenceType,
                          String referenceId,
                          String razorpayOrderId,
                          String razorpayPaymentId,
                          String description) {
        BigDecimal normalized = normalizePositive(amount);
        wallet.setBalance(normalizeMoney(wallet.getBalance()).add(normalized).setScale(2, RoundingMode.HALF_UP));
        wallet = walletRepository.save(wallet);
        ledgerRepository.save(WalletLedgerEntry.builder()
                .walletId(wallet.getId())
                .customerId(user.getId())
                .type(type)
                .status(WalletTransactionStatus.SUCCEEDED)
                .amount(normalized)
                .balanceAfter(wallet.getBalance())
                .referenceType(referenceType)
                .referenceId(referenceId)
                .razorpayOrderId(razorpayOrderId)
                .razorpayPaymentId(razorpayPaymentId)
                .description(description)
                .build());
        auditService.log("CREDIT_WALLET", "WALLET", wallet.getId(), user.getEmail(),
                "Credited Rs. " + normalized.toPlainString()
                        + "; type=" + type
                        + "; reference=" + referenceType + ":" + referenceId
                        + "; providerOrderId=" + safeIdentifier(razorpayOrderId)
                        + "; providerPaymentId=" + safeIdentifier(razorpayPaymentId));
        return wallet;
    }

    private Wallet debitWithdrawal(Wallet wallet,
                                   User user,
                                   BigDecimal amount,
                                   WalletTopUpAttempt source,
                                   RazorpayPaymentService.RefundResult refund) {
        BigDecimal normalized = normalizeWithdrawalAmount(amount);
        BigDecimal available = normalizeMoney(wallet.getBalance());
        if (available.compareTo(normalized) < 0) {
            throw new BadRequestException("Wallet balance changed before withdrawal could complete.");
        }
        wallet.setBalance(available.subtract(normalized).setScale(2, RoundingMode.HALF_UP));
        wallet = walletRepository.save(wallet);
        ledgerRepository.save(WalletLedgerEntry.builder()
                .walletId(wallet.getId())
                .customerId(user.getId())
                .type(WalletLedgerType.WITHDRAWAL_REFUND)
                .status(WalletTransactionStatus.SUCCEEDED)
                .amount(normalized.negate())
                .balanceAfter(wallet.getBalance())
                .referenceType("WALLET_REFUND")
                .referenceId(refund.refundId())
                .razorpayPaymentId(source.getRazorpayPaymentId())
                .description("Withdrawal refunded to original payment method")
                .build());
        auditService.log("WITHDRAW_WALLET", "WALLET", wallet.getId(), user.getEmail(),
                "Withdrew Rs. " + normalized.toPlainString()
                        + "; providerPaymentId=" + safeIdentifier(source.getRazorpayPaymentId())
                        + "; providerRefundId=" + safeIdentifier(refund.refundId()));
        return wallet;
    }

    private DebitOutcome debitAvailable(Wallet wallet, User user, BigDecimal requested, ChargingSession session) {
        return debitAvailable(wallet, user, requested,
                "CHARGING_SESSION",
                String.valueOf(session.getId()),
                "Live charging debit");
    }

    private DebitOutcome debitAvailable(Wallet wallet,
                                        User user,
                                        BigDecimal requested,
                                        String referenceType,
                                        String referenceId,
                                        String description) {
        BigDecimal available = normalizeMoney(wallet.getBalance());
        BigDecimal debit = requested.min(available).setScale(2, RoundingMode.HALF_UP);
        if (debit.compareTo(ZERO) <= 0) {
            return new DebitOutcome(wallet, ZERO);
        }
        wallet.setBalance(available.subtract(debit).setScale(2, RoundingMode.HALF_UP));
        wallet = walletRepository.save(wallet);
        ledgerRepository.save(WalletLedgerEntry.builder()
                .walletId(wallet.getId())
                .customerId(user.getId())
                .type(WalletLedgerType.CHARGING_DEBIT)
                .status(WalletTransactionStatus.SUCCEEDED)
                .amount(debit.negate())
                .balanceAfter(wallet.getBalance())
                .referenceType(referenceType)
                .referenceId(referenceId)
                .description(description)
                .build());
        auditService.log("DEBIT_WALLET", "WALLET", wallet.getId(), user.getEmail(),
                "Debited Rs. " + debit.toPlainString()
                        + "; reference=" + referenceType + ":" + referenceId);
        return new DebitOutcome(wallet, debit);
    }

    private record DebitOutcome(Wallet wallet, BigDecimal debited) {}

    private User findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private boolean hasConfirmedMandate(Wallet wallet) {
        return wallet != null
                && !isBlank(wallet.getRazorpayCustomerId())
                && !isBlank(wallet.getRazorpayTokenId())
                && "CONFIRMED".equalsIgnoreCase(wallet.getMandateStatus());
    }

    private boolean isTestSandboxMandate(Wallet wallet) {
        return !productionMode
                && razorpayPaymentService.isTestMode()
                && wallet != null
                && wallet.getRazorpayTokenId() != null
                && wallet.getRazorpayTokenId().startsWith("test_mandate_");
    }

    private BigDecimal threshold(Wallet wallet) {
        return normalizePositive(wallet.getAutoTopUpThreshold() != null ? wallet.getAutoTopUpThreshold() : DEFAULT_THRESHOLD);
    }

    private BigDecimal normalizePositive(BigDecimal value) {
        BigDecimal normalized = normalizeMoney(value);
        if (normalized.compareTo(ZERO) <= 0) {
            throw new BadRequestException("Amount must be greater than zero.");
        }
        if (normalized.compareTo(MAX_AUTO_DEBIT) > 0) {
            throw new BadRequestException("Amount cannot exceed Rs. " + MAX_AUTO_DEBIT.toPlainString() + ".");
        }
        return normalized;
    }

    private BigDecimal normalizeTopUpAmount(BigDecimal value) {
        BigDecimal normalized = normalizePositive(value);
        if (normalized.compareTo(MIN_TOP_UP) < 0) {
            throw new BadRequestException("Top-up amount must be at least Rs. " + MIN_TOP_UP.toPlainString() + ".");
        }
        return normalized;
    }

    private BigDecimal normalizeWithdrawalAmount(BigDecimal value) {
        BigDecimal normalized = normalizeMoney(value);
        if (normalized.compareTo(ZERO) <= 0) {
            throw new BadRequestException("Withdrawal amount must be greater than zero.");
        }
        if (normalized.compareTo(MAX_AUTO_DEBIT) > 0) {
            throw new BadRequestException("Withdrawal amount cannot exceed Rs. "
                    + MAX_AUTO_DEBIT.toPlainString() + ".");
        }
        return normalized;
    }

    private BigDecimal normalizeMoney(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private List<WalletTopUpAttempt> refundableTopUps(Long customerId) {
        return topUpAttemptRepository
                .findByCustomerIdAndStatusOrderByCompletedAtDesc(customerId, WalletTransactionStatus.SUCCEEDED)
                .stream()
                .filter(attempt -> !isBlank(attempt.getRazorpayPaymentId()))
                .filter(attempt -> refundableAmount(attempt).compareTo(ZERO) > 0)
                .toList();
    }

    private BigDecimal refundableAmount(WalletTopUpAttempt attempt) {
        BigDecimal amount = normalizeMoney(attempt.getAmount());
        BigDecimal refunded = normalizeMoney(attempt.getRefundedAmount());
        BigDecimal refundable = amount.subtract(refunded).setScale(2, RoundingMode.HALF_UP);
        return refundable.compareTo(ZERO) < 0 ? ZERO : refundable;
    }

    private BigDecimal calculateWithdrawableBalance(User user, Wallet wallet) {
        BigDecimal sourceRefundable = refundableTopUps(user.getId()).stream()
                .map(this::refundableAmount)
                .reduce(ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        return normalizeMoney(wallet.getBalance()).min(sourceRefundable).setScale(2, RoundingMode.HALF_UP);
    }

    private String normalizeMandateMethod(String method) {
        String normalized = String.valueOf(method == null ? "card" : method).trim().toLowerCase();
        if (normalized.equals("upi") || normalized.equals("emandate") || normalized.equals("card")) {
            return normalized;
        }
        return "card";
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String safeIdentifier(String value) {
        return isBlank(value) ? "none" : value;
    }

    private WalletResponse toResponse(Wallet wallet) {
        return WalletResponse.builder()
                .id(wallet.getId())
                .balance(normalizeMoney(wallet.getBalance()))
                .withdrawableBalance(calculateWithdrawableBalance(findUserById(wallet.getCustomerId()), wallet))
                .autoTopUpEnabled(wallet.isAutoTopUpEnabled())
                .autoTopUpThreshold(threshold(wallet))
                .autoTopUpAmount(normalizeMoney(wallet.getAutoTopUpAmount()))
                .maxAutoDebitAmount(normalizeMoney(wallet.getMaxAutoDebitAmount()))
                .mandateStatus(wallet.getMandateStatus())
                .mandateMethod(wallet.getMandateMethod())
                .mandateFailureReason(wallet.getMandateFailureReason())
                .paymentMethodLabel(wallet.getPaymentMethodLabel())
                .paymentMethodLast4(wallet.getPaymentMethodLast4())
                .paymentMethodNetwork(wallet.getPaymentMethodNetwork())
                .mandateConfirmedAt(wallet.getMandateConfirmedAt())
                .lastAutoTopUpAt(wallet.getLastAutoTopUpAt())
                .updatedAt(wallet.getUpdatedAt())
                .build();
    }

    private User findUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private WalletLedgerEntryResponse toLedgerResponse(WalletLedgerEntry entry) {
        return WalletLedgerEntryResponse.builder()
                .id(entry.getId())
                .type(entry.getType() != null ? entry.getType().name() : null)
                .status(entry.getStatus() != null ? entry.getStatus().name() : null)
                .amount(normalizeMoney(entry.getAmount()))
                .balanceAfter(normalizeMoney(entry.getBalanceAfter()))
                .referenceType(entry.getReferenceType())
                .referenceId(entry.getReferenceId())
                .razorpayOrderId(entry.getRazorpayOrderId())
                .razorpayPaymentId(entry.getRazorpayPaymentId())
                .description(entry.getDescription())
                .createdAt(entry.getCreatedAt())
                .build();
    }
}
