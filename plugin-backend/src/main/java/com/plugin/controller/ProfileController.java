package com.plugin.controller;

import com.plugin.dto.request.ChangePasswordRequest;
import com.plugin.dto.request.DeleteAccountRequest;
import com.plugin.dto.request.ProfileUpdateRequest;
import com.plugin.dto.response.UserResponse;
import com.plugin.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping
    public ResponseEntity<UserResponse> getProfile(Authentication auth) {
        return ResponseEntity.ok(profileService.getProfile(auth.getName()));
    }

    @PutMapping
    public ResponseEntity<UserResponse> updateProfile(
            @RequestBody ProfileUpdateRequest request,
            Authentication auth) {
        return ResponseEntity.ok(profileService.updateProfile(auth.getName(), request));
    }

    @PostMapping("/delete")
    public ResponseEntity<java.util.Map<String, String>> deleteAccount(
            @RequestBody DeleteAccountRequest request,
            Authentication auth) {
        return ResponseEntity.ok(profileService.deleteAccount(auth.getName(), request));
    }

    @PostMapping("/change-password")
    public ResponseEntity<java.util.Map<String, String>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            Authentication auth) {
        return ResponseEntity.ok(profileService.changePassword(auth.getName(), request));
    }

    @GetMapping("/delete")
    public ResponseEntity<java.util.Map<String, String>> deleteAccountGet(
            @RequestParam String password,
            Authentication auth) {
        DeleteAccountRequest request = new DeleteAccountRequest();
        request.setPassword(password);
        return ResponseEntity.ok(profileService.deleteAccount(auth.getName(), request));
    }
}
