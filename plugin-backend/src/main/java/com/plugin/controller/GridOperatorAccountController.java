package com.plugin.controller;

import com.plugin.service.GridOperatorAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/admin/grid-operators")
@RequiredArgsConstructor
public class GridOperatorAccountController {
    private final GridOperatorAccountService service;
    @GetMapping public List<GridOperatorAccountService.Account> list() { return service.list(); }
    @PostMapping public GridOperatorAccountService.Account grant(@RequestBody GrantRequest request, Principal actor) {
        return service.grant(request.email(), actor.getName());
    }
    @DeleteMapping("/{id}") public GridOperatorAccountService.Account revoke(@PathVariable Long id, Principal actor) {
        return service.revoke(id, actor.getName());
    }
    public record GrantRequest(String email) {}
}
