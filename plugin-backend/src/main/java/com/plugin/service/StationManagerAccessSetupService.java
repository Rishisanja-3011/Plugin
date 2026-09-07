package com.plugin.service;

import com.plugin.dto.request.StationManagerAccessSetupRequest;
import com.plugin.entity.StationManagerAccessInvitation;
import com.plugin.entity.StationManagerApplication;
import com.plugin.entity.User;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.StationManagerAccessInvitationRepository;
import com.plugin.repository.StationManagerApplicationRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StationManagerAccessSetupService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final StationManagerAccessInvitationRepository invitationRepository;
    private final StationManagerApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final StationManagerCredentialEmailService emailService;

    @Value("${app.station-manager.access-invitation-minutes:30}")
    private long invitationMinutes;

    @Transactional
    public void issueInvitation(StationManagerApplication application, User user, String actor) {
        if (application == null || application.getId() == null || user == null || user.getId() == null) {
            throw new BadRequestException("The station manager account is not ready for an invitation.");
        }

        LocalDateTime now = LocalDateTime.now();
        for (StationManagerAccessInvitation existing
                : invitationRepository.findByApplicationIdAndUsedAtIsNull(application.getId())) {
            existing.setUsedAt(now);
            invitationRepository.save(existing);
        }

        byte[] tokenBytes = new byte[32];
        SECURE_RANDOM.nextBytes(tokenBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);

        invitationRepository.save(StationManagerAccessInvitation.builder()
                .tokenHash(hashToken(rawToken))
                .applicationId(application.getId())
                .userId(user.getId())
                .createdBy(actor)
                .createdAt(now)
                .expiresAt(now.plusMinutes(Math.max(5L, Math.min(invitationMinutes, 1440L))))
                .build());

        emailService.sendAccessInvitation(
                application.getEmail(),
                application.getFullName(),
                user.getEmail(),
                rawToken
        );
    }

    @Transactional
    public Map<String, String> completeSetup(StationManagerAccessSetupRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("Passwords do not match.");
        }

        LocalDateTime now = LocalDateTime.now();
        StationManagerAccessInvitation invitation = invitationRepository
                .findByTokenHashAndUsedAtIsNullAndExpiresAtAfter(hashToken(request.getToken().trim()), now)
                .orElseThrow(() -> new BadRequestException("This access invitation is invalid or expired."));

        User user = userRepository.findById(invitation.getUserId())
                .orElseThrow(() -> new BadRequestException("This access invitation is invalid or expired."));
        StationManagerApplication application = applicationRepository.findById(invitation.getApplicationId())
                .orElseThrow(() -> new BadRequestException("This access invitation is invalid or expired."));
        if (application.getUser() == null || !user.getId().equals(application.getUser().getId())) {
            throw new BadRequestException("This access invitation is invalid or expired.");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setActive(true);
        user.revokeSessions();
        userRepository.save(user);

        invitation.setUsedAt(now);
        try {
            invitationRepository.save(invitation);
        } catch (OptimisticLockingFailureException ex) {
            throw new BadRequestException("This access invitation has already been used.");
        }

        application.setCredentialsIssuedAt(now);
        applicationRepository.save(application);

        return Map.of("message", "Station manager access is ready. You can now sign in.");
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Required token digest is unavailable.", ex);
        }
    }
}
