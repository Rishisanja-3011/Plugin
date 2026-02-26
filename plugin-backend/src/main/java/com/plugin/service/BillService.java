package com.plugin.service;

import com.plugin.dto.response.BillResponse;
import com.plugin.entity.Bill;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.Duration;

@Service
@RequiredArgsConstructor
public class BillService {

    private final BillRepository billRepository;
    private final UserRepository userRepository;
    private final InvoicePdfService invoicePdfService;
    private final InvoiceEmailService invoiceEmailService;

    public record InvoiceFile(byte[] data, String filename) {}

    public Page<BillResponse> getMyBills(String email, Pageable pageable) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return billRepository.findByCustomerIdOrderByCreatedAtDesc(customer.getId(), pageable)
                .map(this::toResponse);
    }

    public long getMyUnpaidCount(String email) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return billRepository.countByCustomerIdAndPaymentStatus(customer.getId(), PaymentStatus.UNPAID);
    }

    public Page<BillResponse> getAllBills(Pageable pageable) {
        return billRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::toResponse);
    }

    public Page<BillResponse> getAllBills(Long stationId, LocalDateTime start, LocalDateTime end, Pageable pageable) {
        return billRepository.findAllFiltered(stationId, start, end, pageable)
                .map(this::toResponse);
    }

    public BillResponse getBillById(Long id) {
        return toResponse(billRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found")));
    }

    @Transactional(readOnly = true)
    public InvoiceFile getInvoiceForCustomer(String email, Long id) {
        User customer = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Bill bill = billRepository.findByIdAndCustomerId(id, customer.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found"));
        byte[] pdf = invoicePdfService.generateInvoice(bill);
        return new InvoiceFile(pdf, buildFileName(bill));
    }

    @Transactional(readOnly = true)
    public InvoiceFile getInvoiceForAdmin(Long id) {
        Bill bill = billRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found"));
        byte[] pdf = invoicePdfService.generateInvoice(bill);
        return new InvoiceFile(pdf, buildFileName(bill));
    }

    @Transactional
    public BillResponse markAsPaid(Long id) {
        Bill bill = billRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found"));
        if (bill.getPaymentStatus() == PaymentStatus.PAID) {
            throw new BadRequestException("Bill is already paid");
        }
        bill.setPaymentStatus(PaymentStatus.PAID);
        bill.setPaidAt(LocalDateTime.now());
        bill = billRepository.save(bill);
        invoiceEmailService.sendPaidInvoice(bill.getId());
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
        Long durationSeconds = null;
        if (b.getSession() != null && b.getSession().getStartTime() != null && b.getSession().getEndTime() != null) {
            long seconds = Duration.between(b.getSession().getStartTime(), b.getSession().getEndTime()).getSeconds();
            durationSeconds = Math.max(0, seconds);
        }
        return BillResponse.builder()
                .id(b.getId())
                .invoiceNumber(b.getInvoiceNumber())
                .sessionId(b.getSession().getId())
                .customerId(b.getCustomer().getId())
                .customerName(b.getCustomer().getFullName())
                .stationId(b.getStation().getId())
                .stationName(b.getStation().getName())
                .energyKwh(b.getEnergyKwh())
                .durationMinutes(b.getDurationMinutes())
                .durationSeconds(durationSeconds)
                .rateApplied(b.getRateApplied())
                .rateType(b.getRateType())
                .totalAmount(b.getTotalAmount())
                .paymentStatus(b.getPaymentStatus().name())
                .createdAt(b.getCreatedAt())
                .paidAt(b.getPaidAt())
                .build();
    }

    private String buildFileName(Bill bill) {
        String base = bill.getInvoiceNumber() != null ? bill.getInvoiceNumber() : ("invoice-" + bill.getId());
        base = base.replaceAll("[^a-zA-Z0-9-_]", "_");
        return base + ".pdf";
    }
}
