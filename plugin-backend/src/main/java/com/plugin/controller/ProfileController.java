package com.plugin.controller;

import com.plugin.dto.request.ChangePasswordRequest;
import com.plugin.dto.request.ChangePasswordOtpRequest;
import com.plugin.dto.request.DeleteAccountOtpRequest;
import com.plugin.dto.request.DeleteAccountRequest;
import com.plugin.dto.request.ForgotChangePasswordRequest;
import com.plugin.dto.request.ForgotDeleteAccountRequest;
import com.plugin.dto.request.ProfileUpdateRequest;
import com.plugin.dto.request.VerifyChangePasswordOtpRequest;
import com.plugin.dto.request.VerifyDeleteAccountOtpRequest;
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

    @DeleteMapping("/vehicles/{vehicleId}")
    public ResponseEntity<UserResponse> deleteVehicle(
            @PathVariable Long vehicleId,
            Authentication auth) {
        return ResponseEntity.ok(profileService.deleteVehicle(auth.getName(), vehicleId));
    }

    @PostMapping("/delete")
    public ResponseEntity<java.util.Map<String, String>> deleteAccount(
            @Valid @RequestBody DeleteAccountRequest request,
            Authentication auth) {
        return ResponseEntity.ok(profileService.deleteAccount(auth.getName(), request));
    }

    @PostMapping("/delete/send-otp")
    public ResponseEntity<java.util.Map<String, String>> sendDeleteAccountOtp(
            @Valid @RequestBody DeleteAccountOtpRequest request,
            Authentication auth) {
        return ResponseEntity.ok(profileService.sendDeleteAccountOtp(auth.getName(), request));
    }

    @PostMapping("/delete/verify-otp")
    public ResponseEntity<java.util.Map<String, String>> verifyDeleteAccountOtp(
            @Valid @RequestBody VerifyDeleteAccountOtpRequest request,
            Authentication auth) {
        return ResponseEntity.ok(profileService.verifyDeleteAccountOtp(auth.getName(), request));
    }

    @PostMapping("/delete/forgot/send-otp")
    public ResponseEntity<java.util.Map<String, String>> sendForgotDeleteAccountOtp(Authentication auth) {
        return ResponseEntity.ok(profileService.sendForgotDeleteAccountOtp(auth.getName()));
    }

    @PostMapping("/delete/forgot")
    public ResponseEntity<java.util.Map<String, String>> deleteAccountWithOtpOnly(
            @Valid @RequestBody ForgotDeleteAccountRequest request,
            Authentication auth) {
        return ResponseEntity.ok(profileService.deleteAccountWithOtpOnly(auth.getName(), request));
    }

    @PostMapping("/change-password")
    public ResponseEntity<java.util.Map<String, String>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            Authentication auth) {
        return ResponseEntity.ok(profileService.changePassword(auth.getName(), request));
    }

    @PostMapping("/change-password/send-otp")
    public ResponseEntity<java.util.Map<String, String>> sendChangePasswordOtp(
            @Valid @RequestBody ChangePasswordOtpRequest request,
            Authentication auth) {
        return ResponseEntity.ok(profileService.sendChangePasswordOtp(auth.getName(), request));
    }

    @PostMapping("/change-password/verify-otp")
    public ResponseEntity<java.util.Map<String, String>> verifyChangePasswordOtp(
            @Valid @RequestBody VerifyChangePasswordOtpRequest request,
            Authentication auth) {
        return ResponseEntity.ok(profileService.verifyChangePasswordOtp(auth.getName(), request));
    }

    @PostMapping("/change-password/forgot/send-otp")
    public ResponseEntity<java.util.Map<String, String>> sendForgotChangePasswordOtp(Authentication auth) {
        return ResponseEntity.ok(profileService.sendForgotChangePasswordOtp(auth.getName()));
    }

    @PostMapping("/change-password/forgot")
    public ResponseEntity<java.util.Map<String, String>> changePasswordWithOtpOnly(
            @Valid @RequestBody ForgotChangePasswordRequest request,
            Authentication auth) {
        return ResponseEntity.ok(profileService.changePasswordWithOtpOnly(auth.getName(), request));
    }

    @GetMapping("/delete")
    public ResponseEntity<java.util.Map<String, String>> deleteAccountGet(
            @RequestParam String password,
            @RequestParam String otp,
            Authentication auth) {
        DeleteAccountRequest request = new DeleteAccountRequest();
        request.setPassword(password);
        request.setOtp(otp);
        return ResponseEntity.ok(profileService.deleteAccount(auth.getName(), request));
    }
}
