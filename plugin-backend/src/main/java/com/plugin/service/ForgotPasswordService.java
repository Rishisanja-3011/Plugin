package com.plugin.service;

import com.plugin.dto.request.ResetPasswordRequest;
import com.plugin.dto.request.SendOtpRequest;
import com.plugin.dto.request.VerifyOtpRequest;
import com.plugin.entity.PasswordResetOtp;
import com.plugin.entity.User;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.PasswordResetOtpRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    private static final int OTP_LENGTH = 6;
    private static final int OTP_EXPIRY_MINUTES = 10;
    public static final String PURPOSE_PASSWORD_RESET = "PASSWORD_RESET";
    public static final String PURPOSE_CHANGE_PASSWORD = "CHANGE_PASSWORD";
    public static final String PURPOSE_DELETE_ACCOUNT = "DELETE_ACCOUNT";

    public Map<String, Object> checkEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("No account found with this email"));

        Map<String, Object> result = new HashMap<>();
        result.put("message", "Account found");
        result.put("maskedEmail", maskEmail(user.getEmail()));
        boolean hasPhone = user.getPhone() != null && !user.getPhone().isBlank();
        result.put("hasPhone", hasPhone);
        if (hasPhone) {
            result.put("maskedPhone", maskPhone(user.getPhone()));
        }
        return result;
    }

    @Transactional
    public Map<String, String> sendOtp(SendOtpRequest request) {
        return sendOtp(request, PURPOSE_PASSWORD_RESET);
    }

    @Transactional
    public Map<String, String> sendOtp(SendOtpRequest request, String purpose) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("No account found with this email"));

        String method = request.getDeliveryMethod().toUpperCase();
        String normalizedPurpose = normalizePurpose(purpose);
        if (!"EMAIL".equals(method) && !"PHONE".equals(method)) {
            throw new BadRequestException("Invalid delivery method. Use EMAIL or PHONE");
        }
        if ("PHONE".equals(method) && (user.getPhone() == null || user.getPhone().isBlank())) {
            throw new BadRequestException("No phone number registered for this account");
        }

        String otp = generateOtp();

        LocalDateTime now = LocalDateTime.now();
        PasswordResetOtp otpEntity = PasswordResetOtp.builder()
                .email(user.getEmail())
                .otp(otp)
                .deliveryMethod(method)
                .purpose(normalizedPurpose)
                .expiresAt(now.plusMinutes(OTP_EXPIRY_MINUTES))
                .used(false)
                .createdAt(now)
                .build();
        otpRepository.save(otpEntity);

        boolean delivered;
        if ("EMAIL".equals(method)) {
            delivered = sendOtpByEmail(user.getEmail(), otp, normalizedPurpose);
            if (!delivered) {
                log.warn("OTP email was not delivered for {}", user.getEmail());
            }
        } else {
            delivered = sendOtpByPhone(user.getPhone(), otp);
        }

        Map<String, String> result = new HashMap<>();
        if (delivered) {
            result.put("message", getOtpSentMessage(normalizedPurpose));
        } else {
            result.put("message", "OTP could not be delivered. Please check email configuration and try again.");
        }
        result.put("delivered", Boolean.toString(delivered));
        return result;
    }

    public Map<String, String> verifyOtp(VerifyOtpRequest request) {
        return verifyOtp(request.getEmail(), request.getOtp());
    }

    public Map<String, String> verifyOtp(String email, String otp) {
        return verifyOtp(email, otp, PURPOSE_PASSWORD_RESET);
    }

    public Map<String, String> verifyOtp(String email, String otp, String purpose) {
        verifyActiveOtp(email, otp, purpose);

        Map<String, String> result = new HashMap<>();
        result.put("message", "OTP verified successfully");
        return result;
    }

    @Transactional
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("Passwords do not match");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new BadRequestException("You can't use your old password.");
        }

        PasswordResetOtp otpEntity = verifyActiveOtp(user.getEmail(), request.getOtp(), PURPOSE_PASSWORD_RESET);
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        otpEntity.setUsed(true);
        otpRepository.save(otpEntity);

        Map<String, String> result = new HashMap<>();
        result.put("message", "Password reset successfully");
        return result;
    }

    @Transactional
    public void consumeOtp(String email, String otp) {
        consumeOtp(email, otp, PURPOSE_PASSWORD_RESET);
    }

    @Transactional
    public void consumeOtp(String email, String otp, String purpose) {
        PasswordResetOtp otpEntity = verifyActiveOtp(email, otp, purpose);
        otpEntity.setUsed(true);
        otpRepository.save(otpEntity);
    }

    private PasswordResetOtp verifyActiveOtp(String email, String otp) {
        return verifyActiveOtp(email, otp, PURPOSE_PASSWORD_RESET);
    }

    private PasswordResetOtp verifyActiveOtp(String email, String otp, String purpose) {
        String normalizedPurpose = normalizePurpose(purpose);
        PasswordResetOtp otpEntity = otpRepository
                .findTopByEmailAndPurposeAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                        email, normalizedPurpose, LocalDateTime.now())
                .or(() -> PURPOSE_PASSWORD_RESET.equals(normalizedPurpose)
                        ? otpRepository.findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                                email, LocalDateTime.now())
                            .filter(existing -> existing.getPurpose() == null || existing.getPurpose().isBlank())
                        : java.util.Optional.empty())
                .orElseThrow(() -> new BadRequestException("OTP expired or not found. Please request a new one"));

        if (!otpEntity.getOtp().equals(otp)) {
            throw new BadRequestException("Invalid OTP");
        }
        return otpEntity;
    }

    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int otp = 100000 + random.nextInt(900000);
        return String.valueOf(otp);
    }

    private boolean sendOtpByEmail(String email, String otp, String purpose) {
        if (mailSender == null) {
            log.warn("JavaMailSender not configured");
            return false;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            String from = (mailFrom != null && !mailFrom.isBlank()) ? mailFrom : mailUsername;
            if (from == null || from.isBlank()) {
                log.warn("Mail from address not configured");
                return false;
            }
            message.setTo(email);
            message.setFrom(from);
            message.setSubject(getOtpSubject(purpose));
            message.setText(buildOtpEmailBody(otp, purpose));
            mailSender.send(message);
            log.info("OTP email sent to {}", email);
            return true;
        } catch (Exception e) {
            log.warn("Failed to send OTP email to {}", email);
            return false;
        }
    }

    private boolean sendOtpByPhone(String phone, String otp) {
        log.info("======= PASSWORD RESET OTP for phone {} : {} =======", phone, otp);
        return false;
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

    private String getOtpSentMessage(String purpose) {
        return switch (normalizePurpose(purpose)) {
            case PURPOSE_CHANGE_PASSWORD -> "OTP sent successfully. Please check your registered email to change your password.";
            case PURPOSE_DELETE_ACCOUNT -> "OTP sent successfully. Please check your registered email to delete your account.";
            default -> "OTP sent successfully. Please check your registered email.";
        };
    }

    private String getOtpAction(String purpose) {
        return switch (normalizePurpose(purpose)) {
            case PURPOSE_CHANGE_PASSWORD -> "change your PLUGIN password";
            case PURPOSE_DELETE_ACCOUNT -> "delete your PLUGIN account";
            default -> "reset your PLUGIN password";
        };
    }

    private String maskEmail(String email) {
        int atIndex = email.indexOf('@');
        if (atIndex <= 2) return email;
        return email.charAt(0)
                + "*".repeat(atIndex - 2)
                + email.substring(atIndex - 1);
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "*".repeat(phone.length() - 4) + phone.substring(phone.length() - 4);
    }
}
