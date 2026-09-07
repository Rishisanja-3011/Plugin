package com.plugin.service;

import com.plugin.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Locale;

@Service
public class OtpSecurityService {

    public static final String PURPOSE_REGISTRATION = "REGISTRATION";
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final int MINIMUM_PEPPER_BYTES = 32;

    private final SecretKeySpec key;
    private final int maxAttempts;
    private final long resendCooldownSeconds;

    public OtpSecurityService(@Value("${app.otp.pepper}") String pepper,
                              @Value("${app.otp.max-attempts:5}") int maxAttempts,
                              @Value("${app.otp.resend-cooldown-seconds:60}") long resendCooldownSeconds) {
        if (pepper == null || pepper.isBlank()
                || pepper.getBytes(StandardCharsets.UTF_8).length < MINIMUM_PEPPER_BYTES) {
            throw new IllegalStateException("OTP pepper must contain at least 32 bytes");
        }
        if (maxAttempts < 1 || maxAttempts > 10) {
            throw new IllegalStateException("OTP max attempts must be between 1 and 10");
        }
        if (resendCooldownSeconds < 1) {
            throw new IllegalStateException("OTP resend cooldown must be greater than zero");
        }

        this.key = new SecretKeySpec(pepper.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
        this.maxAttempts = maxAttempts;
        this.resendCooldownSeconds = resendCooldownSeconds;
    }

    public String hash(String email, String purpose, String otp) {
        if (email == null || purpose == null || otp == null) {
            throw new IllegalArgumentException("OTP hash context is incomplete");
        }
        String value = email.trim().toLowerCase(Locale.ROOT)
                + "\n" + purpose.trim().toUpperCase(Locale.ROOT)
                + "\n" + otp;
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(key);
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("OTP hashing is unavailable");
        }
    }

    public boolean matches(String storedHash, String email, String purpose, String otp) {
        if (storedHash == null || storedHash.isBlank() || otp == null) {
            return false;
        }
        byte[] expected = storedHash.getBytes(StandardCharsets.US_ASCII);
        byte[] actual = hash(email, purpose, otp).getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected, actual);
    }

    public void enforceResendCooldown(LocalDateTime lastSentAt, LocalDateTime now) {
        if (lastSentAt != null && lastSentAt.plusSeconds(resendCooldownSeconds).isAfter(now)) {
            throw new BadRequestException("Please wait before requesting another OTP");
        }
    }

    public int maxAttempts() {
        return maxAttempts;
    }
}
