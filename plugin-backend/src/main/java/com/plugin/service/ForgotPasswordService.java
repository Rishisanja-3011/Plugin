package com.plugin.service;

import com.plugin.dto.request.ResetPasswordRequest;
import com.plugin.dto.request.SendOtpRequest;
import com.plugin.dto.request.VerifyOtpRequest;
import com.plugin.dto.response.EmailInboxMessage;
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
import java.util.List;
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

    public Map<String, Object> getEmailInbox(String email) {
        userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("No account found with this email"));

        List<PasswordResetOtp> otps = otpRepository
                .findByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                        email, LocalDateTime.now());

        List<EmailInboxMessage> messages = otps.stream()
                .map(otp -> EmailInboxMessage.builder()
                        .subject("PLUGIN - Password Reset OTP")
                        .body(buildOtpEmailBody(otp.getOtp()))
                        .otp(otp.getOtp())
                        .time(otp.getCreatedAt())
                        .build())
                .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("messages", messages);
        return result;
    }

    @Transactional
    public Map<String, String> sendOtp(SendOtpRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("No account found with this email"));

        String method = request.getDeliveryMethod().toUpperCase();
        if (!"EMAIL".equals(method) && !"PHONE".equals(method)) {
            throw new BadRequestException("Invalid delivery method. Use EMAIL or PHONE");
        }
        if ("PHONE".equals(method) && (user.getPhone() == null || user.getPhone().isBlank())) {
            throw new BadRequestException("No phone number registered for this account");
        }

        String otp = generateOtp();

        PasswordResetOtp otpEntity = PasswordResetOtp.builder()
                .email(user.getEmail())
                .otp(otp)
                .deliveryMethod(method)
                .expiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                .used(false)
                .build();
        otpRepository.save(otpEntity);

        boolean delivered;
        if ("EMAIL".equals(method)) {
            delivered = sendOtpByEmail(user.getEmail(), otp);
            if (!delivered) {
                log.warn("OTP email was not delivered for {}", user.getEmail());
            }
        } else {
            delivered = sendOtpByPhone(user.getPhone(), otp);
        }

        Map<String, String> result = new HashMap<>();
        if (delivered) {
            result.put("message", "OTP sent successfully. Please check your registered email.");
        } else {
            result.put("message", "OTP generated. Delivery is not configured, use the code provided.");
            result.put("otp", otp);
        }
        result.put("delivered", Boolean.toString(delivered));
        return result;
    }

    public Map<String, String> verifyOtp(VerifyOtpRequest request) {
        PasswordResetOtp otpEntity = otpRepository
                .findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                        request.getEmail(), LocalDateTime.now())
                .orElseThrow(() -> new BadRequestException("OTP expired or not found. Please request a new one"));

        if (!otpEntity.getOtp().equals(request.getOtp())) {
            throw new BadRequestException("Invalid OTP");
        }

        Map<String, String> result = new HashMap<>();
        result.put("message", "OTP verified successfully");
        return result;
    }

    @Transactional
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("Passwords do not match");
        }

        PasswordResetOtp otpEntity = otpRepository
                .findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                        request.getEmail(), LocalDateTime.now())
                .orElseThrow(() -> new BadRequestException("OTP expired or not found. Please restart the process"));

        if (!otpEntity.getOtp().equals(request.getOtp())) {
            throw new BadRequestException("Invalid OTP");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        otpEntity.setUsed(true);
        otpRepository.save(otpEntity);

        Map<String, String> result = new HashMap<>();
        result.put("message", "Password reset successfully");
        return result;
    }

    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int otp = 100000 + random.nextInt(900000);
        return String.valueOf(otp);
    }

    private boolean sendOtpByEmail(String email, String otp) {
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
            message.setSubject("PLUGIN - Password Reset OTP");
            message.setText(buildOtpEmailBody(otp));
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

    private String buildOtpEmailBody(String otp) {
        return "Your OTP for password reset is: " + otp
                + "\n\nThis code will expire in " + OTP_EXPIRY_MINUTES + " minutes."
                + "\n\nIf you didn't request this, please ignore this email.";
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
