package com.plugin.service;

import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.repository.UserRepository;
import com.plugin.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GridOperatorAccountServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final AuditService audit = mock(AuditService.class);
    private final GridOperatorAccountService service = new GridOperatorAccountService(users, audit);

    @Test void grantsVerifiedAccountAndRevokesExistingTokens() {
        User user = User.builder().id(12L).email("grid@example.test").active(true).role(Role.CUSTOMER).tokenVersion(4L).build();
        when(users.findByEmailIgnoreCase("grid@example.test")).thenReturn(Optional.of(user));
        service.grant("grid@example.test", "admin@example.test");
        assertEquals(Role.GRID_OPERATOR, user.getRole());
        assertEquals(5L, user.currentTokenVersion());
        verify(audit).log(eq("GRANT_GRID_OPERATOR"), eq("USER"), eq(12L), eq("admin@example.test"), anyString());
    }

    @Test void refusesInactiveAndExistingPrivilegedAccounts() {
        for (Role role : Role.values()) {
            User user = User.builder().role(role).active(false).build();
            when(users.findByEmailIgnoreCase("grid@example.test")).thenReturn(Optional.of(user));
            assertThrows(BadRequestException.class, () -> service.grant("grid@example.test", "admin"));
            if (role != Role.CUSTOMER) {
                user.setActive(true);
                assertThrows(BadRequestException.class, () -> service.grant("grid@example.test", "admin"));
            }
        }
        verify(users, never()).save(any());
    }

    @Test void revocationInvalidatesSessions() {
        User user = User.builder().id(12L).role(Role.GRID_OPERATOR).tokenVersion(1L).build();
        when(users.findById(12L)).thenReturn(Optional.of(user));
        service.revoke(12L, "admin");
        assertEquals(Role.CUSTOMER, user.getRole());
        assertEquals(2L, user.currentTokenVersion());
    }
}
