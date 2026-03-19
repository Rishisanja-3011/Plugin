package com.plugin.service;

import com.plugin.dto.request.ChangePasswordRequest;
import com.plugin.dto.request.DeleteAccountRequest;
import com.plugin.dto.request.ProfileVehicleRequest;
import com.plugin.dto.request.ProfileUpdateRequest;
import com.plugin.dto.response.ProfileVehicleResponse;
import com.plugin.dto.response.UserResponse;
import com.plugin.entity.User;
import com.plugin.entity.UserVehicle;
import com.plugin.enums.PaymentStatus;
import com.plugin.enums.SessionStatus;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.BillRepository;
import com.plugin.repository.BookingRepository;
import com.plugin.repository.ChargingSessionRepository;
import com.plugin.repository.UserRepository;
import com.plugin.repository.UserVehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private static final int MAX_VEHICLES = 3;

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final ChargingSessionRepository chargingSessionRepository;
    private final BillRepository billRepository;
    private final UserVehicleRepository userVehicleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserResponse getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return toResponse(user);
    }

    @Transactional
    public UserResponse updateProfile(String email, ProfileUpdateRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        String initialFullName = normalizeText(user.getFullName());
        String initialPhone = normalizeText(user.getPhone());
        List<UserVehicle> initialVehicles = userVehicleRepository.findByUserIdOrderByActiveDescCreatedAtDesc(user.getId());
        Long initialActiveVehicleId = findActiveVehicleId(initialVehicles);

        if (request.getFullName() != null) {
            String currentFullName = normalizeText(user.getFullName());
            String requestedFullName = normalizeText(request.getFullName());
            if (!isBlank(currentFullName) && !currentFullName.equals(requestedFullName)) {
                throw new BadRequestException("Full name cannot be edited once saved");
            }
            if (isBlank(currentFullName) && !isBlank(requestedFullName)) {
                user.setFullName(requestedFullName);
            }
        }

        if (request.getPhone() != null) {
            String currentPhone = normalizeText(user.getPhone());
            String requestedPhone = normalizeText(request.getPhone());
            if (!isBlank(currentPhone) && !currentPhone.equals(requestedPhone)) {
                throw new BadRequestException("Mobile number cannot be edited once saved");
            }
            if (isBlank(currentPhone) && !isBlank(requestedPhone)) {
                user.setPhone(requestedPhone);
            }
        }

        if (request.getVehicles() != null) {
            syncVehicles(user, request.getVehicles(), request.getActiveVehicleId());
        } else {
            syncLegacyVehiclePayload(user, request);
        }

        user = userRepository.save(user);
        UserResponse response = toResponse(user);
        logProfileChanges(email, initialFullName, initialPhone, initialVehicles, initialActiveVehicleId, request, response);
        return response;
    }

    @Transactional
    public UserResponse deleteVehicle(String email, Long vehicleId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        UserVehicle vehicle = userVehicleRepository.findByIdAndUserId(vehicleId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found"));

        if (Boolean.TRUE.equals(vehicle.getActive())
                && chargingSessionRepository.existsByCustomerIdAndStatusAndVehicleId(
                        user.getId(), SessionStatus.IN_PROGRESS, vehicleId)) {
            throw new BadRequestException("Cannot delete the active vehicle while a charging session is running");
        }

        if (bookingRepository.existsByVehicleId(vehicleId)) {
            throw new BadRequestException("Cannot delete vehicle linked to bookings");
        }

        boolean removedActive = Boolean.TRUE.equals(vehicle.getActive());
        String deletedVehicleLabel = formatVehicleDescription(
                vehicle.getVehicleNickname(),
                vehicle.getVehicleMake(),
                vehicle.getVehicleModel(),
                vehicle.getVehicleRegistration());
        userVehicleRepository.delete(vehicle);

        List<UserVehicle> remainingVehicles = userVehicleRepository.findByUserIdOrderByActiveDescCreatedAtDesc(user.getId());
        if (remainingVehicles.isEmpty()) {
            clearUserVehicle(user);
        } else {
            UserVehicle activeVehicle = remainingVehicles.stream()
                    .filter(v -> Boolean.TRUE.equals(v.getActive()))
                    .findFirst()
                    .orElse(null);

            if (activeVehicle == null || removedActive) {
                activeVehicle = remainingVehicles.get(0);
            }

            Long activeVehicleId = activeVehicle.getId();
            boolean needsVehicleSave = false;
            for (UserVehicle v : remainingVehicles) {
                boolean shouldBeActive = v.getId() != null && v.getId().equals(activeVehicleId);
                if (Boolean.TRUE.equals(v.getActive()) != shouldBeActive) {
                    v.setActive(shouldBeActive);
                    needsVehicleSave = true;
                }
            }

            if (needsVehicleSave) {
                userVehicleRepository.saveAll(remainingVehicles);
            }

            syncUserVehicleFromActive(user, activeVehicle);
        }

        user = userRepository.save(user);
        auditService.log("DELETE_VEHICLE", "VEHICLE", vehicleId, email,
                "Deleted vehicle: " + deletedVehicleLabel);
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

    private void syncVehicles(User user, List<ProfileVehicleRequest> requestedVehicles, Long activeVehicleId) {
        if (requestedVehicles.size() > MAX_VEHICLES) {
            throw new BadRequestException("You can save up to " + MAX_VEHICLES + " vehicles");
        }

        List<UserVehicle> existing = userVehicleRepository.findByUserIdOrderByActiveDescCreatedAtDesc(user.getId());
        Map<Long, UserVehicle> existingById = new HashMap<>();
        for (UserVehicle vehicle : existing) {
            existingById.put(vehicle.getId(), vehicle);
        }

        if (requestedVehicles.isEmpty()) {
            if (!existing.isEmpty()) {
                userVehicleRepository.deleteAll(existing);
            }
            clearUserVehicle(user);
            return;
        }

        List<UserVehicle> nextVehicles = new ArrayList<>();
        Set<Long> seenIds = new HashSet<>();
        Set<String> seenRegistrations = new HashSet<>();

        for (ProfileVehicleRequest req : requestedVehicles) {
            if (req == null) {
                throw new BadRequestException("Vehicle details are required");
            }

            String nickname = normalizeText(req.getVehicleNickname());
            String make = normalizeText(req.getVehicleMake());
            String model = normalizeText(req.getVehicleModel());
            String registration = normalizeRegistration(req.getVehicleRegistration());

            if (isBlank(make) || isBlank(model) || isBlank(registration)) {
                throw new BadRequestException("Vehicle make, model and registration are required");
            }

            if (!seenRegistrations.add(registration)) {
                throw new BadRequestException("Duplicate vehicle registration: " + registration);
            }

            UserVehicle vehicle;
            if (req.getId() != null) {
                vehicle = existingById.get(req.getId());
                if (vehicle == null) {
                    throw new BadRequestException("Invalid vehicle id: " + req.getId());
                }
                if (!seenIds.add(req.getId())) {
                    throw new BadRequestException("Duplicate vehicle id: " + req.getId());
                }

                String currentMake = normalizeText(vehicle.getVehicleMake());
                String currentModel = normalizeText(vehicle.getVehicleModel());
                String currentRegistration = normalizeRegistration(vehicle.getVehicleRegistration());
                if (!make.equals(currentMake)
                        || !model.equals(currentModel)
                        || !registration.equals(currentRegistration)) {
                    throw new BadRequestException("Saved vehicle make, model and registration cannot be edited once saved");
                }
            } else {
                vehicle = UserVehicle.builder().user(user).build();
            }

            vehicle.setVehicleNickname(nickname);
            vehicle.setVehicleMake(make);
            vehicle.setVehicleModel(model);
            vehicle.setVehicleRegistration(registration);
            vehicle.setActive(false);
            nextVehicles.add(vehicle);
        }

        List<UserVehicle> toDelete = new ArrayList<>();
        for (UserVehicle vehicle : existing) {
            if (!seenIds.contains(vehicle.getId())) {
                toDelete.add(vehicle);
            }
        }
        if (!toDelete.isEmpty()) {
            userVehicleRepository.deleteAll(toDelete);
        }

        int activeIndex = resolveActiveIndex(requestedVehicles, activeVehicleId);
        nextVehicles.get(activeIndex).setActive(true);

        List<UserVehicle> savedVehicles = userVehicleRepository.saveAll(nextVehicles);
        UserVehicle activeVehicle = savedVehicles.stream()
                .filter(vehicle -> Boolean.TRUE.equals(vehicle.getActive()))
                .findFirst()
                .orElse(null);

        syncUserVehicleFromActive(user, activeVehicle);
    }

    private int resolveActiveIndex(List<ProfileVehicleRequest> vehicles, Long activeVehicleId) {
        if (activeVehicleId != null) {
            for (int i = 0; i < vehicles.size(); i++) {
                ProfileVehicleRequest vehicle = vehicles.get(i);
                if (vehicle != null && activeVehicleId.equals(vehicle.getId())) {
                    return i;
                }
            }
            throw new BadRequestException("Selected active vehicle is invalid");
        }

        for (int i = 0; i < vehicles.size(); i++) {
            ProfileVehicleRequest vehicle = vehicles.get(i);
            if (vehicle != null && Boolean.TRUE.equals(vehicle.getActive())) {
                return i;
            }
        }

        return 0;
    }

    private void syncLegacyVehiclePayload(User user, ProfileUpdateRequest request) {
        boolean hasLegacyVehiclePayload =
                request.getVehicleMake() != null || request.getVehicleModel() != null || request.getVehicleRegistration() != null;

        if (!hasLegacyVehiclePayload) {
            return;
        }

        String make = request.getVehicleMake() != null
                ? normalizeText(request.getVehicleMake())
                : normalizeText(user.getVehicleMake());
        String model = request.getVehicleModel() != null
                ? normalizeText(request.getVehicleModel())
                : normalizeText(user.getVehicleModel());
        String registration = request.getVehicleRegistration() != null
                ? normalizeRegistration(request.getVehicleRegistration())
                : normalizeRegistration(user.getVehicleRegistration());

        if (isBlank(make) && isBlank(model) && isBlank(registration)) {
            userVehicleRepository.deleteByUserId(user.getId());
            clearUserVehicle(user);
            return;
        }

        if (isBlank(make) || isBlank(model) || isBlank(registration)) {
            throw new BadRequestException("Vehicle make, model and registration are required");
        }

        List<UserVehicle> vehicles = userVehicleRepository.findByUserIdOrderByActiveDescCreatedAtDesc(user.getId());
        UserVehicle activeVehicle = vehicles.stream()
                .filter(vehicle -> Boolean.TRUE.equals(vehicle.getActive()))
                .findFirst()
                .orElseGet(() -> vehicles.isEmpty() ? UserVehicle.builder().user(user).build() : vehicles.get(0));

        for (UserVehicle vehicle : vehicles) {
            if (!vehicle.equals(activeVehicle) && Boolean.TRUE.equals(vehicle.getActive())) {
                vehicle.setActive(false);
            }
        }

        activeVehicle.setVehicleMake(make);
        activeVehicle.setVehicleModel(model);
        activeVehicle.setVehicleRegistration(registration);
        activeVehicle.setActive(true);

        userVehicleRepository.saveAll(vehicles);
        activeVehicle = userVehicleRepository.save(activeVehicle);
        syncUserVehicleFromActive(user, activeVehicle);
    }

    private void syncUserVehicleFromActive(User user, UserVehicle activeVehicle) {
        if (activeVehicle == null) {
            clearUserVehicle(user);
            return;
        }

        user.setVehicleMake(activeVehicle.getVehicleMake());
        user.setVehicleModel(activeVehicle.getVehicleModel());
        user.setVehicleRegistration(activeVehicle.getVehicleRegistration());
    }

    private void clearUserVehicle(User user) {
        user.setVehicleMake(null);
        user.setVehicleModel(null);
        user.setVehicleRegistration(null);
    }

    private String normalizeText(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeRegistration(String value) {
        if (value == null) return null;
        String normalized = value.toUpperCase().replaceAll("[\\s-]", "").trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private UserResponse toResponse(User user) {
        List<UserVehicle> persistedVehicles = userVehicleRepository.findByUserIdOrderByActiveDescCreatedAtDesc(user.getId());

        List<ProfileVehicleResponse> vehicles = new ArrayList<>();
        Long activeVehicleId = null;
        UserVehicle activeVehicle = null;

        for (UserVehicle vehicle : persistedVehicles) {
            boolean isActive = Boolean.TRUE.equals(vehicle.getActive());
            if (isActive && activeVehicleId == null) {
                activeVehicleId = vehicle.getId();
                activeVehicle = vehicle;
            }
            vehicles.add(ProfileVehicleResponse.builder()
                    .id(vehicle.getId())
                    .vehicleNickname(vehicle.getVehicleNickname())
                    .vehicleMake(vehicle.getVehicleMake())
                    .vehicleModel(vehicle.getVehicleModel())
                    .vehicleRegistration(vehicle.getVehicleRegistration())
                    .active(isActive)
                    .build());
        }

        if (activeVehicle == null && !persistedVehicles.isEmpty()) {
            activeVehicle = persistedVehicles.get(0);
            activeVehicleId = activeVehicle.getId();
            Long resolvedActiveVehicleId = activeVehicleId;
            vehicles = vehicles.stream()
                    .map(vehicle -> ProfileVehicleResponse.builder()
                            .id(vehicle.getId())
                            .vehicleNickname(vehicle.getVehicleNickname())
                            .vehicleMake(vehicle.getVehicleMake())
                            .vehicleModel(vehicle.getVehicleModel())
                            .vehicleRegistration(vehicle.getVehicleRegistration())
                            .active(vehicle.getId() != null && vehicle.getId().equals(resolvedActiveVehicleId))
                            .build())
                    .toList();
        }

        if (vehicles.isEmpty() && !isBlank(user.getVehicleRegistration())) {
            vehicles = List.of(ProfileVehicleResponse.builder()
                    .id(null)
                    .vehicleNickname(null)
                    .vehicleMake(user.getVehicleMake())
                    .vehicleModel(user.getVehicleModel())
                    .vehicleRegistration(user.getVehicleRegistration())
                    .active(true)
                    .build());
        }

        String activeVehicleMake = activeVehicle != null ? activeVehicle.getVehicleMake() : user.getVehicleMake();
        String activeVehicleModel = activeVehicle != null ? activeVehicle.getVehicleModel() : user.getVehicleModel();
        String activeVehicleRegistration = activeVehicle != null ? activeVehicle.getVehicleRegistration() : user.getVehicleRegistration();

        return UserResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole().name())
                .vehicleMake(activeVehicleMake)
                .vehicleModel(activeVehicleModel)
                .vehicleRegistration(activeVehicleRegistration)
                .vehicles(vehicles)
                .activeVehicleId(activeVehicleId)
                .createdAt(user.getCreatedAt())
                .build();
    }

    private Long findActiveVehicleId(List<UserVehicle> vehicles) {
        return vehicles.stream()
                .filter(vehicle -> Boolean.TRUE.equals(vehicle.getActive()))
                .map(UserVehicle::getId)
                .findFirst()
                .orElseGet(() -> vehicles.isEmpty() ? null : vehicles.get(0).getId());
    }

    private void logProfileChanges(String email,
                                   String initialFullName,
                                   String initialPhone,
                                   List<UserVehicle> initialVehicles,
                                   Long initialActiveVehicleId,
                                   ProfileUpdateRequest request,
                                   UserResponse response) {
        String currentFullName = normalizeText(response.getFullName());
        String currentPhone = normalizeText(response.getPhone());
        if (!Objects.equals(initialFullName, currentFullName) || !Objects.equals(initialPhone, currentPhone)) {
            auditService.log("UPDATE_PROFILE", "PROFILE", response.getId(), email,
                    "Profile updated. Full name: " + safeValue(currentFullName)
                            + ", phone: " + safeValue(currentPhone));
        }

        if (request.getVehicles() == null) {
            return;
        }

        Map<String, ProfileVehicleResponse> savedVehiclesByRegistration = new HashMap<>();
        for (ProfileVehicleResponse vehicle : response.getVehicles()) {
            String registration = normalizeRegistration(vehicle.getVehicleRegistration());
            if (registration != null) {
                savedVehiclesByRegistration.put(registration, vehicle);
            }
        }

        for (ProfileVehicleRequest vehicle : request.getVehicles()) {
            if (vehicle == null || vehicle.getId() != null) {
                continue;
            }
            String registration = normalizeRegistration(vehicle.getVehicleRegistration());
            ProfileVehicleResponse savedVehicle = registration != null
                    ? savedVehiclesByRegistration.get(registration)
                    : null;
            auditService.log("ADD_VEHICLE", "VEHICLE", savedVehicle != null ? savedVehicle.getId() : null, email,
                    "Added vehicle: " + formatVehicleDescription(
                            vehicle.getVehicleNickname(),
                            vehicle.getVehicleMake(),
                            vehicle.getVehicleModel(),
                            vehicle.getVehicleRegistration()));
        }

        Map<Long, UserVehicle> initialVehiclesById = new HashMap<>();
        for (UserVehicle vehicle : initialVehicles) {
            if (vehicle.getId() != null) {
                initialVehiclesById.put(vehicle.getId(), vehicle);
            }
        }

        for (ProfileVehicleRequest vehicle : request.getVehicles()) {
            if (vehicle == null || vehicle.getId() == null) {
                continue;
            }

            UserVehicle initialVehicle = initialVehiclesById.get(vehicle.getId());
            if (initialVehicle == null) {
                continue;
            }

            String previousNickname = normalizeText(initialVehicle.getVehicleNickname());
            String nextNickname = normalizeText(vehicle.getVehicleNickname());
            if (!Objects.equals(previousNickname, nextNickname)) {
                auditService.log("UPDATE_VEHICLE_NICKNAME", "VEHICLE", vehicle.getId(), email,
                        "Vehicle nickname changed from " + safeValue(previousNickname)
                                + " to " + safeValue(nextNickname)
                                + " for " + formatVehicleDescription(
                                nextNickname,
                                vehicle.getVehicleMake(),
                                vehicle.getVehicleModel(),
                                vehicle.getVehicleRegistration()));
            }
        }

        if (!Objects.equals(initialActiveVehicleId, response.getActiveVehicleId()) && response.getActiveVehicleId() != null) {
            ProfileVehicleResponse activeVehicle = response.getVehicles().stream()
                    .filter(vehicle -> response.getActiveVehicleId().equals(vehicle.getId()))
                    .findFirst()
                    .orElse(null);
            if (activeVehicle != null) {
                auditService.log("SET_ACTIVE_VEHICLE", "VEHICLE", activeVehicle.getId(), email,
                        "Active vehicle set to: " + formatVehicleDescription(
                                activeVehicle.getVehicleNickname(),
                                activeVehicle.getVehicleMake(),
                                activeVehicle.getVehicleModel(),
                                activeVehicle.getVehicleRegistration()));
            }
        }
    }

    private String formatVehicleDescription(String nickname, String make, String model, String registration) {
        String nicknameText = normalizeText(nickname);
        String makeText = normalizeText(make);
        String modelText = normalizeText(model);
        String registrationText = normalizeRegistration(registration);

        String label = ((makeText == null ? "" : makeText) + " " + (modelText == null ? "" : modelText)).trim();
        if (label.isEmpty()) {
            label = "Vehicle";
        }

        if (nicknameText != null) {
            label = nicknameText + " (" + label + ")";
        }

        if (registrationText != null) {
            label = label + " [" + registrationText + "]";
        }

        return label;
    }

    private String safeValue(String value) {
        return value == null ? "-" : value;
    }
}
