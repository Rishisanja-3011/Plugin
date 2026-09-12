package com.plugin.service;

import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.repository.UserRepository;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GridOperatorAccountService {
    private final UserRepository users;
    private final AuditService audit;

    public List<Account> list() {
        return users.findByRole(Role.GRID_OPERATOR).stream().map(this::view).toList();
    }

    @Transactional
    public Account grant(String email, String actor) {
        if (email == null || email.isBlank()) throw new BadRequestException("Account email is required");
        User user = users.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Register and verify the operator account first"));
        if (!Boolean.TRUE.equals(user.getActive()) || user.getRole() != Role.CUSTOMER) {
            throw new BadRequestException("Only an active verified customer account can be assigned grid access");
        }
        user.setRole(Role.GRID_OPERATOR);
        user.revokeSessions();
        users.save(user);
        audit.log("GRANT_GRID_OPERATOR", "USER", user.getId(), actor, "Assigned grid operator role; existing sessions revoked");
        return view(user);
    }

    @Transactional
    public Account revoke(Long id, String actor) {
        User user = users.findById(id).orElseThrow(() -> new ResourceNotFoundException("Account not found"));
        if (user.getRole() != Role.GRID_OPERATOR) throw new BadRequestException("Account is not a grid operator");
        user.setRole(Role.CUSTOMER);
        user.revokeSessions();
        users.save(user);
        audit.log("REVOKE_GRID_OPERATOR", "USER", id, actor, "Grid access removed; existing sessions revoked");
        return view(user);
    }

    private Account view(User user) { return new Account(user.getId(), user.getFullName(), user.getEmail(), user.getActive()); }
    public record Account(Long id, String fullName, String email, Boolean active) {}
}
