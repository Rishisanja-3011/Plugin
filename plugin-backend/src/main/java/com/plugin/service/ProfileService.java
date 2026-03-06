package com.plugin.service;

import com.plugin.dto.request.ChangePasswordRequest;
import com.plugin.dto.request.DeleteAccountRequest;
import com.plugin.dto.request.ProfileUpdateRequest;
import com.plugin.dto.response.UserResponse;
import com.plugin.entity.User;
import com.plugin.enums.PaymentStatus;
import com.plugin.enums.SessionStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.BillRepository;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.ChargingSessionRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final ChargingSessionRepository chargingSessionRepository;
    private final BillRepository billRepository;
    private final PasswordEncoder passwordEncoder;

    public UserResponse getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return toResponse(user);
    }

    @Transactional
    public UserResponse updateProfile(String email, ProfileUpdateRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (request.getFullName() != null) user.setFullName(request.getFullName());
        if (request.getPhone() != null) user.setPhone(request.getPhone());
        if (request.getVehicleMake() != null) user.setVehicleMake(request.getVehicleMake());
        if (request.getVehicleModel() != null) user.setVehicleModel(request.getVehicleModel());
        if (request.getVehicleRegistration() != null) user.setVehicleRegistration(request.getVehicleRegistration());

        user = userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public Map<String, String> deleteAccount(String email, DeleteAccountRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (Boolean.FALSE.equals(user.getActive())) {
            return Map.of("message", "Account already deleted");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BadRequestException("Invalid password");
        }

        Long userId = user.getId();
        boolean hasActiveBookings = bookingRepository.existsActiveByCustomerId(
                userId, java.time.LocalDateTime.now());
        boolean hasActiveSessions = chargingSessionRepository.existsByCustomerIdAndStatus(
                userId, SessionStatus.IN_PROGRESS);
        boolean hasUnpaidBills = billRepository.existsByCustomerIdAndPaymentStatus(
                userId, PaymentStatus.UNPAID);

        if (hasActiveBookings || hasActiveSessions || hasUnpaidBills) {
            throw new BadRequestException("Cannot delete account with active bookings, active sessions, or unpaid bills");
        }

        user.setActive(false);
        userRepository.save(user);
        return Map.of("message", "Account deleted successfully");
    }

    @Transactional
    public Map<String, String> changePassword(String email, ChangePasswordRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new BadRequestException("Current password is incorrect");
        }

        if (request.getConfirmPassword() != null
                && !request.getConfirmPassword().equals(request.getNewPassword())) {
            throw new BadRequestException("New password and confirmation do not match");
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new BadRequestException("You can't use your old password.");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        return Map.of("message", "Password updated successfully");
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole().name())
                .vehicleMake(user.getVehicleMake())
                .vehicleModel(user.getVehicleModel())
                .vehicleRegistration(user.getVehicleRegistration())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
