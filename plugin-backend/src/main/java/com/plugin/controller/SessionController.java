package com.plugin.controller;

import com.plugin.dto.response.SessionResponse;
import com.plugin.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @PostMapping("/start/{bookingId}")
    public ResponseEntity<SessionResponse> startSession(
            @PathVariable Long bookingId,
            Authentication auth) {
        return ResponseEntity.ok(sessionService.startSession(bookingId, auth.getName()));
    }

    @PostMapping("/end/{sessionId}")
    public ResponseEntity<SessionResponse> endSession(
            @PathVariable Long sessionId,
            Authentication auth) {
        return ResponseEntity.ok(sessionService.endMySession(sessionId, auth.getName()));
    }

    @GetMapping("/my")
    public ResponseEntity<Page<SessionResponse>> getMySessions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication auth) {
        return ResponseEntity.ok(sessionService.getMySessions(auth.getName(),
                PageRequest.of(safePage(page), safeSize(size))));
    }

    @GetMapping("/my/active")
    public ResponseEntity<List<SessionResponse>> getMyActiveSessions(Authentication auth) {
        return ResponseEntity.ok(sessionService.getMyActiveSessions(auth.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SessionResponse> getSession(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(sessionService.getSessionForCaller(id, auth.getName()));
    }

    private int safePage(int page) {
        return Math.max(0, page);
    }

    private int safeSize(int size) {
        return Math.max(1, Math.min(100, size));
    }
}
