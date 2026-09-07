package com.plugin.service;

import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.AuditLogRepository;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminInputSecurityTest {

    @Mock private UserRepository userRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private AuditService auditService;
    @Mock private AuditLogRepository auditLogRepository;

    @InjectMocks private AdminCustomerService adminCustomerService;
    @InjectMocks private AuditService concreteAuditService;

    @Test
    void rejectsOversizedCustomerSearchBeforeRepositoryAccess() {
        assertThrows(BadRequestException.class, () -> adminCustomerService.getCustomers(
                PageRequest.of(0, 20), "x".repeat(101), null));

        verifyNoInteractions(userRepository, bookingRepository);
    }

    @Test
    void customerStatusChangeFailsClosedWhenAuditWriteFails() {
        User customer = User.builder()
                .id(42L)
                .email("customer@example.test")
                .role(Role.CUSTOMER)
                .active(true)
                .build();
        when(userRepository.findById(42L)).thenReturn(Optional.of(customer));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new IllegalStateException("audit unavailable"))
                .when(auditService).log(any(), any(), any(), any(), any());

        assertThrows(IllegalStateException.class, () -> adminCustomerService.updateCustomerStatus(
                42L, false, "admin@example.test"));

        verify(auditService).log(
                "UPDATE_CUSTOMER_STATUS", "USER", 42L, "admin@example.test",
                "Customer account set to DEACTIVATED");
    }

    @Test
    void rejectsOversizedAuditFilterBeforeRepositoryAccess() {
        assertThrows(BadRequestException.class, () -> concreteAuditService.getByEntityType(
                "x".repeat(65), PageRequest.of(0, 20)));

        verify(auditLogRepository, never()).findByEntityTypeOrderByCreatedAtDesc(any(), any());
    }
}
