package com.plugin.service;

import com.plugin.entity.Bill;
import com.plugin.entity.User;
import com.plugin.enums.PaymentStatus;
import com.plugin.enums.Role;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.BillRepository;
import com.plugin.repository.ChargingSessionRepository;
import com.plugin.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BillServiceSecurityTest {

    @Mock private BillRepository billRepository;
    @Mock private ChargingSessionRepository sessionRepository;
    @Mock private UserRepository userRepository;
    @Mock private InvoicePdfService invoicePdfService;
    @Mock private InvoiceEmailService invoiceEmailService;
    @Mock private EntityReferenceResolver referenceResolver;
    @Mock private WalletService walletService;
    @Mock private AuditService auditService;

    @InjectMocks private BillService billService;

    @BeforeEach
    void runReferenceCacheCallbacks() {
        lenient().when(referenceResolver.withCache(any())).thenAnswer(invocation ->
                ((Supplier<?>) invocation.getArgument(0)).get());
    }

    @Test
    void hidesAnotherCustomersBillWithoutUnscopedLookup() {
        User attacker = User.builder()
                .id(101L)
                .email("attacker@example.com")
                .role(Role.CUSTOMER)
                .build();
        when(userRepository.findByEmail(attacker.getEmail())).thenReturn(Optional.of(attacker));
        when(billRepository.findByIdAndCustomerId(102L, attacker.getId())).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> billService.getBillForCaller(attacker.getEmail(), 102L));

        verify(billRepository, never()).findById(102L);
    }

    @Test
    void neutralizesSpreadsheetFormulaCellsInStatements() {
        User customer = User.builder().id(111L).email("owner@example.com").role(Role.CUSTOMER).build();
        Bill bill = Bill.builder()
                .id(112L)
                .invoiceNumber("=HYPERLINK(\"https://invalid.example\")")
                .customer(customer)
                .customerId(customer.getId())
                .totalAmount(new BigDecimal("1.00"))
                .paymentStatus(PaymentStatus.PAID)
                .createdAt(LocalDateTime.of(2026, 8, 9, 12, 0))
                .build();
        when(userRepository.findByEmail(customer.getEmail())).thenReturn(Optional.of(customer));
        when(billRepository.findStatementBillsForCustomer(any(), any(), any())).thenReturn(List.of(bill));
        when(referenceResolver.hydrateBillSummary(bill)).thenReturn(bill);

        BillService.StatementFile statement = billService.getStatementForCustomer(
                customer.getEmail(), LocalDate.of(2026, 8, 9), LocalDate.of(2026, 8, 9));
        String csv = new String(statement.data(), StandardCharsets.UTF_8);

        assertTrue(csv.contains("\"'=HYPERLINK"));
    }

    @Test
    void rejectsStatementRangesLongerThanOneYear() {
        assertThrows(BadRequestException.class, () -> billService.getStatementForCustomer(
                "owner@example.com", LocalDate.of(2025, 1, 1), LocalDate.of(2026, 1, 2)));
    }

    @Test
    void adminPaymentRecordsActorAmountAndInvoiceInAuditLog() {
        Bill bill = Bill.builder()
                .id(121L)
                .invoiceNumber("INV-121")
                .totalAmount(new BigDecimal("42.50"))
                .paymentStatus(PaymentStatus.UNPAID)
                .build();
        when(billRepository.findById(121L)).thenReturn(Optional.of(bill));
        when(referenceResolver.hydrate(bill)).thenReturn(bill);
        when(referenceResolver.hydrateBillSummary(bill)).thenReturn(bill);
        when(billRepository.save(bill)).thenReturn(bill);

        billService.markAsPaid(121L, "admin@example.test");

        verify(auditService).log(
                "ADMIN_MARK_BILL_PAID", "BILL", 121L, "admin@example.test",
                "Admin marked invoice INV-121 paid for Rs. 42.50");
    }
}
