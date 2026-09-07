package com.plugin.service;

import com.plugin.dto.request.ResetPasswordRequest;
import com.plugin.dto.request.SendOtpRequest;
import com.plugin.dto.request.VerifyOtpRequest;
import com.plugin.config.IdentityNormalizer;
import com.plugin.entity.PasswordResetOtp;
import com.plugin.entity.User;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.PasswordResetOtpRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ForgotPasswordService {

    private final UserRepository userRepository;
    private final PasswordResetOtpRepository otpRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpSecurityService otpSecurityService;
    private final MongoTemplate mongoTemplate;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    private static final int OTP_EXPIRY_MINUTES = 10;
    public static final String PURPOSE_PASSWORD_RESET = "PASSWORD_RESET";
    public static final String PURPOSE_CHANGE_PASSWORD = "CHANGE_PASSWORD";
    public static final String PURPOSE_DELETE_ACCOUNT = "DELETE_ACCOUNT";

    public Map<String, Object> checkEmail(String email) {
        String normalizedEmail = IdentityNormalizer.email(email);
        Map<String, Object> result = new HashMap<>();
        result.put("message", "If an active account exists, you can request an email code.");
        result.put("maskedEmail", maskEmail(normalizedEmail));
        result.put("hasPhone", false);
        return result;
    }

    @Transactional
    public Map<String, String> sendOtp(SendOtpRequest request) {
        return sendOtp(request, PURPOSE_PASSWORD_RESET);
    }

    @Transactional
    public Map<String, String> sendOtp(SendOtpRequest request, String purpose) {
        String method = request.getDeliveryMethod().trim().toUpperCase();
        if (!"EMAIL".equals(method)) {
            throw new BadRequestException("Only EMAIL OTP delivery is supported");
        }

        String normalizedEmail = IdentityNormalizer.email(request.getEmail());
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .filter(candidate -> Boolean.TRUE.equals(candidate.getActive()))
                .orElse(null);
        if (user == null) {
            return genericOtpResponse();
        }

        String normalizedPurpose = normalizePurpose(purpose);
        String challengeEmail = IdentityNormalizer.email(user.getEmail());
        LocalDateTime now = LocalDateTime.now();
        var latest = otpRepository.findTopByEmailAndPurposeOrderByCreatedAtDesc(
                challengeEmail, normalizedPurpose);
        if (latest.isPresent()) {
            try {
                otpSecurityService.enforceResendCooldown(latest.get().getCreatedAt(), now);
            } catch (BadRequestException ex) {
                return genericOtpResponse();
            }
        }

        invalidateExistingChallenges(challengeEmail, normalizedPurpose);
        String otp = generateOtp();
        PasswordResetOtp otpEntity = PasswordResetOtp.builder()
                .email(challengeEmail)
                .otpHash(otpSecurityService.hash(challengeEmail, normalizedPurpose, otp))
                .deliveryMethod(method)
                .purpose(normalizedPurpose)
                .expiresAt(now.plusMinutes(OTP_EXPIRY_MINUTES))
                .used(false)
                .failedAttempts(0)
                .createdAt(now)
                .build();
        otpEntity = otpRepository.save(otpEntity);

        boolean delivered = sendOtpByEmail(user.getEmail(), otp, normalizedPurpose);
        if (!delivered) {
            otpRepository.delete(otpEntity);
        }

        return genericOtpResponse();
    }

    public Map<String, String> verifyOtp(VerifyOtpRequest request) {
        return verifyOtp(request.getEmail(), request.getOtp());
    }

    public Map<String, String> verifyOtp(String email, String otp) {
        return verifyOtp(email, otp, PURPOSE_PASSWORD_RESET);
    }

    public Map<String, String> verifyOtp(String email, String otp, String purpose) {
        verifyActiveOtp(IdentityNormalizer.email(email), otp, purpose);
        return Map.of("message", "OTP verified successfully");
    }

    @Transactional
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("Passwords do not match");
        }

        String normalizedEmail = IdentityNormalizer.email(request.getEmail());
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .filter(candidate -> Boolean.TRUE.equals(candidate.getActive()))
                .orElseThrow(() -> new BadRequestException(
                        "Unable to reset password with the supplied credentials"));

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new BadRequestException("You can't use your old password.");
        }

        consumeOtp(user.getEmail(), request.getOtp(), PURPOSE_PASSWORD_RESET);
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.revokeSessions();
        userRepository.save(user);

        return Map.of("message", "Password reset successfully");
    }

    @Transactional
    public void consumeOtp(String email, String otp) {
        consumeOtp(email, otp, PURPOSE_PASSWORD_RESET);
    }

    @Transactional
    public void consumeOtp(String email, String otp, String purpose) {
        email = IdentityNormalizer.email(email);
        String normalizedPurpose = normalizePurpose(purpose);
        PasswordResetOtp active = findActiveChallenge(email, normalizedPurpose);
        String expectedHash = otpSecurityService.hash(email, normalizedPurpose, otp);

        Query claimQuery = Query.query(Criteria.where("_id").is(active.getMongoId())
                .and("used").is(false)
                .and("expiresAt").gt(LocalDateTime.now())
                .and("failedAttempts").lt(otpSecurityService.maxAttempts())
                .and("otpHash").is(expectedHash));
        PasswordResetOtp claimed = mongoTemplate.findAndModify(
                claimQuery,
                new Update().set("used", true),
                FindAndModifyOptions.options().returnNew(true),
                PasswordResetOtp.class
        );
        if (claimed == null) {
            recordFailedAttempt(active);
            throw new BadRequestException("Invalid, expired, used, or locked OTP");
        }
    }

    private PasswordResetOtp verifyActiveOtp(String email, String otp, String purpose) {
        String normalizedPurpose = normalizePurpose(purpose);
        PasswordResetOtp active = findActiveChallenge(email, normalizedPurpose);
        if (!otpSecurityService.matches(active.getOtpHash(), email, normalizedPurpose, otp)) {
            recordFailedAttempt(active);
            throw new BadRequestException("Invalid OTP");
        }
        return active;
    }

    private PasswordResetOtp findActiveChallenge(String email, String normalizedPurpose) {
        PasswordResetOtp active = otpRepository
                .findTopByEmailAndPurposeAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                        email, normalizedPurpose, LocalDateTime.now())
                .orElseThrow(() -> new BadRequestException("OTP expired or not found. Please request a new one"));
        if (active.getFailedAttempts() >= otpSecurityService.maxAttempts()) {
            throw new BadRequestException("OTP is locked. Please request a new one");
        }
        return active;
    }

    private void recordFailedAttempt(PasswordResetOtp active) {
        Query query = Query.query(Criteria.where("_id").is(active.getMongoId())
                .and("used").is(false)
                .and("expiresAt").gt(LocalDateTime.now())
                .and("failedAttempts").lt(otpSecurityService.maxAttempts()));
        mongoTemplate.updateFirst(query, new Update().inc("failedAttempts", 1), PasswordResetOtp.class);
    }

    private void invalidateExistingChallenges(String email, String purpose) {
        Query query = Query.query(Criteria.where("email").is(email)
                .and("purpose").is(purpose)
                .and("used").is(false));
        mongoTemplate.updateMulti(query, new Update().set("used", true), PasswordResetOtp.class);
    }

    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int otp = 100000 + random.nextInt(900000);
        return String.valueOf(otp);
    }

    private boolean sendOtpByEmail(String email, String otp, String purpose) {
        if (mailSender == null) {
            log.warn("JavaMailSender is not configured; OTP email was not sent");
            return false;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            String from = (mailFrom != null && !mailFrom.isBlank()) ? mailFrom : mailUsername;
            if (from == null || from.isBlank()) {
                log.warn("Mail sender address is not configured; OTP email was not sent");
                return false;
            }
            message.setTo(email);
            message.setFrom(from);
            message.setSubject(getOtpSubject(purpose));
            message.setText(buildOtpEmailBody(otp, purpose));
            mailSender.send(message);
            log.info("OTP email sent");
            return true;
        } catch (Exception ex) {
            log.warn("OTP email delivery failed; type={}", ex.getClass().getName());
            return false;
        }
    }

    private String buildOtpEmailBody(String otp, String purpose) {
        return "Your OTP to " + getOtpAction(purpose) + " is: " + otp
                + "\n\nThis code will expire in " + OTP_EXPIRY_MINUTES + " minutes."
                + "\n\nIf you didn't request this, please ignore this email.";
    }

    private String normalizePurpose(String purpose) {
        if (purpose == null || purpose.isBlank()) {
            return PURPOSE_PASSWORD_RESET;
        }
        return purpose.trim().toUpperCase();
    }

    private String getOtpSubject(String purpose) {
        return switch (normalizePurpose(purpose)) {
            case PURPOSE_CHANGE_PASSWORD -> "PLUGIN - Change Password OTP";
            case PURPOSE_DELETE_ACCOUNT -> "PLUGIN - Delete Account OTP";
            default -> "PLUGIN - Password Reset OTP";
        };
    }

    private Map<String, String> genericOtpResponse() {
        Map<String, String> result = new HashMap<>();
        result.put("message", "If an active account exists, an email code will be sent.");
        // Kept for client compatibility; this value is deliberately not an account-existence oracle.
        result.put("delivered", "true");
        return result;
    }

    private String getOtpAction(String purpose) {
        return switch (normalizePurpose(purpose)) {
            case PURPOSE_CHANGE_PASSWORD -> "change your PLUGIN password";
            case PURPOSE_DELETE_ACCOUNT -> "delete your PLUGIN account";
            default -> "reset your PLUGIN password";
        };
    }

    private String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return "";
        }
        email = email.trim().toLowerCase(java.util.Locale.ROOT);
        int atIndex = email.indexOf('@');
        if (atIndex <= 2) return email;
        return email.charAt(0)
                + "*".repeat(atIndex - 2)
                + email.substring(atIndex - 1);
    }
}
