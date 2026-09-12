package com.plugin.service;

import com.plugin.config.AppClock;
import com.plugin.dto.response.BillResponse;
import com.plugin.entity.Bill;
import com.plugin.entity.ChargingSession;
import com.plugin.entity.Station;
import com.plugin.entity.User;
import com.plugin.enums.PaymentStatus;
import com.plugin.enums.Role;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.BillRepository;
import com.plugin.repository.ChargingSessionRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BillService {

    private final BillRepository billRepository;
    private final ChargingSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final InvoicePdfService invoicePdfService;
    private final InvoiceEmailService invoiceEmailService;
    private final EntityReferenceResolver referenceResolver;
    private final WalletService walletService;
    private final AuditService auditService;

    public record InvoiceFile(byte[] data, String filename) {}
    public record StatementFile(byte[] data, String filename, int rowCount) {}

    private static final DateTimeFormatter STATEMENT_DATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    public Page<BillResponse> getMyBills(String email, Pageable pageable) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return referenceResolver.withCache(() ->
                billRepository.findByCustomerIdOrderByCreatedAtDesc(customer.getId(), pageable)
                        .map(this::toResponse));
    }

    public long getMyUnpaidCount(String email) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return billRepository.countByCustomerIdAndPaymentStatus(customer.getId(), PaymentStatus.UNPAID);
    }

    public Page<BillResponse> getAllBills(Pageable pageable) {
        return referenceResolver.withCache(() ->
                billRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::toResponse));
    }

    public Page<BillResponse> getAllBills(Long stationId, LocalDateTime start, LocalDateTime end, Pageable pageable) {
        return referenceResolver.withCache(() ->
                billRepository.findAllFiltered(stationId, start, end, pageable)
                        .map(this::toResponse));
    }

    public BillResponse getBillById(Long id) {
        return referenceResolver.withCache(() ->
                toResponse(billRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Bill not found"))));
    }

    public BillResponse getBillForCaller(String email, Long id) {
        User actor = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Bill bill = actor.getRole() == Role.ADMIN
                ? billRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Bill not found"))
                : billRepository.findByIdAndCustomerId(id, actor.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Bill not found"));
        return referenceResolver.withCache(() -> toResponse(bill));
    }

    @Transactional(readOnly = true)
    public InvoiceFile getInvoiceForCustomer(String email, Long id) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Bill bill = billRepository.findByIdAndCustomerId(id, customer.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found"));
        bill = referenceResolver.hydrate(bill);
        byte[] pdf = invoicePdfService.generateInvoice(bill);
        return new InvoiceFile(pdf, buildFileName(bill));
    }

    @Transactional(readOnly = true)
    public InvoiceFile getInvoiceForAdmin(Long id) {
        Bill bill = billRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found"));
        bill = referenceResolver.hydrate(bill);
        byte[] pdf = invoicePdfService.generateInvoice(bill);
        return new InvoiceFile(pdf, buildFileName(bill));
    }

    @Transactional(readOnly = true)
    public StatementFile getStatementForCustomer(String email, LocalDate from, LocalDate to) {
        LocalDate effectiveTo = to != null ? to : AppClock.today();
        LocalDate effectiveFrom = from != null ? from : effectiveTo.minusDays(365);
        validateStatementRange(effectiveFrom, effectiveTo);
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        LocalDateTime start = effectiveFrom.atStartOfDay();
        LocalDateTime endExclusive = effectiveTo.plusDays(1).atStartOfDay();

        List<Bill> bills = referenceResolver.withCache(() ->
                billRepository.findStatementBillsForCustomer(customer.getId(), start, endExclusive).stream()
                        .map(referenceResolver::hydrateBillSummary)
                        .toList());
        String csv = buildStatementCsv(bills);
        String filename = buildStatementFileName(effectiveFrom, effectiveTo);
        return new StatementFile(csv.getBytes(StandardCharsets.UTF_8), filename, bills.size());
    }

    @Transactional
    public BillResponse markAsPaid(Long id, String actor) {
        Bill bill = billRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found"));
        bill = referenceResolver.hydrate(bill);
        if (bill.getPaymentStatus() == PaymentStatus.PAID) {
            throw new BadRequestException("Bill is already paid");
        }
        bill = completePayment(bill);
        auditService.log("ADMIN_MARK_BILL_PAID", "BILL", bill.getId(), actor,
                "Admin marked invoice " + bill.getInvoiceNumber() + " paid for Rs. "
                        + normalizeMoney(bill.getTotalAmount()).toPlainString());
        return toResponse(bill);
    }

    @Transactional
    public BillResponse payMyBillFromWallet(String email, Long id) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Bill bill = billRepository.findByIdAndCustomerId(id, customer.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found"));
        bill = referenceResolver.hydrate(bill);
        if (bill.getPaymentStatus() == PaymentStatus.PAID) {
            return toResponse(bill);
        }

        BigDecimal amountDue = resolveWalletAmountDue(bill);
        if (amountDue.compareTo(BigDecimal.ZERO) <= 0) {
            return toResponse(completePayment(bill));
        }

        WalletService.WalletSettlementResult settlement = walletService.settleBill(
                customer,
                bill.getId(),
                amountDue,
                bill.getInvoiceNumber()
        );
        if (!settlement.paid()) {
            throw new BadRequestException(settlement.reason());
        }
        applyWalletSettlementToSession(bill, settlement);
        return toResponse(completePayment(bill));
    }

    public BigDecimal getTotalRevenue() {
        return billRepository.getTotalRevenue();
    }

    public BigDecimal getRevenueInRange(LocalDateTime start, LocalDateTime end) {
        return billRepository.getRevenueInRange(start, end);
    }

    public BigDecimal getRevenueByStationInRange(Long stationId, LocalDateTime start, LocalDateTime end) {
        return billRepository.getRevenueByStationInRange(stationId, start, end);
    }

    private BillResponse toResponse(Bill b) {
        b = referenceResolver.hydrateBillSummary(b);
        ChargingSession session = b.getSession();
        User customer = b.getCustomer();
        Station station = b.getStation();
        BigDecimal walletDebited = session != null
                ? normalizeMoney(session.getWalletDebitedAmount())
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal walletAmountDue = b.getPaymentStatus() == PaymentStatus.PAID
                ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                : resolveWalletAmountDue(b);
        Long durationSeconds = b.getDurationSeconds();
        if (durationSeconds != null && durationSeconds > 0) {
            durationSeconds = Math.max(0, durationSeconds);
        } else if (b.getDurationMinutes() != null && b.getDurationMinutes() > 0) {
            durationSeconds = Math.max(0, b.getDurationMinutes() * 60L);
        } else if (session != null && session.getStartTime() != null && session.getEndTime() != null) {
            long seconds = Duration.between(session.getStartTime(), session.getEndTime()).getSeconds();
            durationSeconds = Math.max(0, seconds);
        }
        return BillResponse.builder()
                .id(b.getId())
                .invoiceNumber(b.getInvoiceNumber())
                .sessionId(session != null ? session.getId() : b.getSessionId())
                .customerId(customer != null ? customer.getId() : b.getCustomerId())
                .customerName(customer != null ? customer.getFullName() : null)
                .stationId(station != null ? station.getId() : b.getStationId())
                .stationName(station != null ? station.getName() : null)
                .energyKwh(b.getEnergyKwh())
                .durationMinutes(b.getDurationMinutes())
                .durationSeconds(durationSeconds)
                .rateApplied(b.getRateApplied())
                .rateType(b.getRateType())
                .totalAmount(b.getTotalAmount())
                .walletDebitedAmount(walletDebited)
                .walletAmountDue(walletAmountDue)
                .chargingPreference(b.getChargingPreference())
                .renewableSharePercent(b.getRenewableSharePercent())
                .carbonKg(b.getCarbonKg())
                .carbonSavedKg(b.getCarbonSavedKg())
                .greenScore(b.getGreenScore())
                .energyDataMode(b.getEnergyDataMode())
                .energySource(b.getEnergySource())
                .paymentStatus(b.getPaymentStatus() != null ? b.getPaymentStatus().name() : null)
                .createdAt(b.getCreatedAt())
                .paidAt(b.getPaidAt())
                .build();
    }

    private Bill completePayment(Bill bill) {
        bill.setPaymentStatus(PaymentStatus.PAID);
        bill.setPaidAt(LocalDateTime.now());
        bill = billRepository.save(bill);
        schedulePaidInvoiceEmail(bill.getId());
        return bill;
    }

    private void schedulePaidInvoiceEmail(Long billId) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    invoiceEmailService.sendPaidInvoice(billId);
                }
            });
            return;
        }
        invoiceEmailService.sendPaidInvoice(billId);
    }

    private void applyWalletSettlementToSession(Bill bill, WalletService.WalletSettlementResult settlement) {
        ChargingSession session = bill.getSession();
        if (session == null || settlement == null) {
            return;
        }
        BigDecimal nextDebited = normalizeMoney(session.getWalletDebitedAmount())
                .add(normalizeMoney(settlement.walletDebitedAmount()))
                .setScale(2, RoundingMode.HALF_UP);
        session.setWalletDebitedAmount(nextDebited);
        session.setWalletBalanceAfterLastDebit(settlement.balanceAfter());
        session.setWalletLastCheckedAt(AppClock.now());
        sessionRepository.save(session);
    }

    private BigDecimal resolveWalletAmountDue(Bill bill) {
        BigDecimal total = normalizeMoney(bill.getTotalAmount());
        ChargingSession session = bill.getSession();
        BigDecimal alreadyDebited = session != null
                ? normalizeMoney(session.getWalletDebitedAmount())
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal remaining = total.subtract(alreadyDebited).setScale(2, RoundingMode.HALF_UP);
        return remaining.compareTo(BigDecimal.ZERO) < 0
                ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                : remaining;
    }

    private BigDecimal normalizeMoney(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private String buildFileName(Bill bill) {
        String base = bill.getInvoiceNumber() != null ? bill.getInvoiceNumber() : ("invoice-" + bill.getId());
        base = base.replaceAll("[^a-zA-Z0-9-_]", "_");
        return base + ".pdf";
    }

    private void validateStatementRange(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new BadRequestException("From date cannot be after To date.");
        }
        if (from != null && to != null && from.plusDays(365).isBefore(to)) {
            throw new BadRequestException("Billing statements are limited to 366 days.");
        }
    }

    private String buildStatementCsv(List<Bill> bills) {
        StringBuilder csv = new StringBuilder();
        csv.append("Invoice Number,Station,Session ID,Billed On,Energy (kWh),Duration,Rate,Amount,Payment Status\n");
        for (Bill bill : bills) {
            csv.append(csvEscape(bill.getInvoiceNumber())).append(',')
                    .append(csvEscape(bill.getStation() != null ? bill.getStation().getName() : "-")).append(',')
                    .append(csvEscape(bill.getSession() != null ? bill.getSession().getId() : "-")).append(',')
                    .append(csvEscape(formatDateTime(bill.getCreatedAt()))).append(',')
                    .append(csvEscape(formatDecimal(bill.getEnergyKwh()))).append(',')
                    .append(csvEscape(formatDuration(bill))).append(',')
                    .append(csvEscape(formatRate(bill))).append(',')
                    .append(csvEscape(formatDecimal(bill.getTotalAmount()))).append(',')
                    .append(csvEscape(bill.getPaymentStatus() != null ? bill.getPaymentStatus().name() : "UNPAID"))
                    .append('\n');
        }
        return csv.toString();
    }

    private String buildStatementFileName(LocalDate from, LocalDate to) {
        String fromLabel = from != null ? from.toString() : "start";
        String toLabel = to != null ? to.toString() : "today";
        return "billing-statement_" + fromLabel + "_to_" + toLabel + ".csv";
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? "-" : STATEMENT_DATE_TIME_FORMATTER.format(value);
    }

    private String formatDecimal(BigDecimal value) {
        return value == null ? "" : value.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private String formatDuration(Bill bill) {
        long seconds = 0;
        if (bill.getDurationSeconds() != null && bill.getDurationSeconds() > 0) {
            seconds = Math.max(0, bill.getDurationSeconds());
        } else if (bill.getDurationMinutes() != null && bill.getDurationMinutes() > 0) {
            seconds = Math.max(0, bill.getDurationMinutes() * 60);
        } else if (bill.getSession() != null && bill.getSession().getStartTime() != null && bill.getSession().getEndTime() != null) {
            seconds = Math.max(0, Duration.between(
                    bill.getSession().getStartTime(),
                    bill.getSession().getEndTime()
            ).getSeconds());
        }
        long mins = seconds / 60;
        long rem = seconds % 60;
        return mins + " min " + rem + " sec";
    }

    private String formatRate(Bill bill) {
        String amount = bill.getRateApplied() != null ? formatDecimal(bill.getRateApplied()) : "-";
        return bill.getRateType() != null && !bill.getRateType().isBlank()
                ? amount + " / " + bill.getRateType()
                : amount;
    }

    private String csvEscape(Object value) {
        String text = value == null ? "" : String.valueOf(value);
        String leadingTrimmed = text.stripLeading();
        if (leadingTrimmed.length() > 1
                && "=+-@".indexOf(leadingTrimmed.charAt(0)) >= 0) {
            text = "'" + text;
        }
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }
}
