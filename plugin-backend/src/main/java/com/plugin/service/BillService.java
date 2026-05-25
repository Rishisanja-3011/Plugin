package com.plugin.service;

import com.plugin.dto.response.BillResponse;
import com.plugin.entity.Bill;
import com.plugin.entity.ChargingSession;
import com.plugin.entity.Station;
import com.plugin.entity.User;
import com.plugin.enums.PaymentStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.BillRepository;
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
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BillService {

    private final BillRepository billRepository;
    private final UserRepository userRepository;
    private final InvoicePdfService invoicePdfService;
    private final InvoiceEmailService invoiceEmailService;
    private final EntityReferenceResolver referenceResolver;

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
        validateStatementRange(from, to);
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        LocalDateTime start = from != null ? from.atStartOfDay() : null;
        LocalDateTime endExclusive = to != null ? to.plusDays(1).atStartOfDay() : null;

        List<Bill> bills = referenceResolver.withCache(() ->
                billRepository.findStatementBillsForCustomer(customer.getId(), start, endExclusive).stream()
                        .map(referenceResolver::hydrateBillSummary)
                        .toList());
        String csv = buildStatementCsv(bills);
        String filename = buildStatementFileName(from, to);
        return new StatementFile(csv.getBytes(StandardCharsets.UTF_8), filename, bills.size());
    }

    @Transactional
    public BillResponse markAsPaid(Long id) {
        Bill bill = billRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found"));
        bill = referenceResolver.hydrate(bill);
        if (bill.getPaymentStatus() == PaymentStatus.PAID) {
            throw new BadRequestException("Bill is already paid");
        }
        bill.setPaymentStatus(PaymentStatus.PAID);
        bill.setPaidAt(LocalDateTime.now());
        bill = billRepository.save(bill);

        final Long billId = bill.getId();
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    invoiceEmailService.sendPaidInvoice(billId);
                }
            });
        } else {
            invoiceEmailService.sendPaidInvoice(billId);
        }

        return toResponse(bill);
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
        Long durationSeconds = null;
        if (session != null && session.getStartTime() != null && session.getEndTime() != null) {
            long seconds = Duration.between(session.getStartTime(), session.getEndTime()).getSeconds();
            durationSeconds = Math.max(0, seconds);
        } else if (b.getDurationMinutes() != null) {
            durationSeconds = Math.max(0, b.getDurationMinutes() * 60L);
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
                .paymentStatus(b.getPaymentStatus() != null ? b.getPaymentStatus().name() : null)
                .createdAt(b.getCreatedAt())
                .paidAt(b.getPaidAt())
                .build();
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
        if (bill.getSession() != null && bill.getSession().getStartTime() != null && bill.getSession().getEndTime() != null) {
            seconds = Math.max(0, Duration.between(
                    bill.getSession().getStartTime(),
                    bill.getSession().getEndTime()
            ).getSeconds());
        } else if (bill.getDurationMinutes() != null) {
            seconds = Math.max(0, bill.getDurationMinutes() * 60);
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
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }
}
