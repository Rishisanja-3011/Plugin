package com.plugin.service;

import com.plugin.config.JwtService;
import com.plugin.dto.request.ConfirmRegistrationOtpRequest;
import com.plugin.dto.request.GoogleAuthRequest;
import com.plugin.dto.request.LoginRequest;
import com.plugin.dto.request.RegisterRequest;
import com.plugin.dto.request.ResendRegistrationOtpRequest;
import com.plugin.dto.response.AuthResponse;
import com.plugin.dto.response.UserResponse;
import com.plugin.entity.PendingRegistration;
import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.PendingRegistrationRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PendingRegistrationRepository pendingRegistrationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Value("${app.google.client-ids:}")
    private String googleClientIds;

    private static final int CONFIRM_EXPIRY_MINUTES = 10;

    @Transactional
    public Map<String, String> register(RegisterRequest request) {
        User existingUser = userRepository.findByEmail(request.getEmail()).orElse(null);
        if (existingUser != null) {
            if (existingUser.getRole() != Role.CUSTOMER) {
                throw new BadRequestException("Email already registered");
            }
            if (Boolean.TRUE.equals(existingUser.getActive())) {
                throw new BadRequestException("Email already registered");
            }
        }

        String otp = generateOtp();
        String token = otp + "-" + UUID.randomUUID().toString().replace("-", "");
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(CONFIRM_EXPIRY_MINUTES);

        PendingRegistration pending = pendingRegistrationRepository.findByEmail(request.getEmail())
                .orElse(PendingRegistration.builder().build());

        pending.setFullName(request.getFullName());
        pending.setEmail(request.getEmail());
        pending.setPassword(passwordEncoder.encode(request.getPassword()));
        pending.setPhone(request.getPhone());
        pending.setToken(token);
        pending.setExpiresAt(expiresAt);

        pending = pendingRegistrationRepository.save(pending);

        boolean delivered = sendConfirmationOtpEmail(pending.getEmail(), otp);
        if (!delivered) {
            pendingRegistrationRepository.delete(pending);
            throw new BadRequestException("Could not send signup OTP email. Please check email configuration and try again.");
        }

        return Map.of("message", "OTP sent to your email. Please confirm your account to complete registration.");
    }

    @Transactional
    public Map<String, String> confirmRegistrationOtp(ConfirmRegistrationOtpRequest request) {
        PendingRegistration pending = pendingRegistrationRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadRequestException("OTP expired or not found. Please register again."));

        if (pending.getExpiresAt().isBefore(LocalDateTime.now())) {
            pendingRegistrationRepository.delete(pending);
            throw new BadRequestException("OTP expired. Please register again.");
        }

        String storedToken = pending.getToken();
        String storedOtp = storedToken == null ? "" : storedToken.split("-", 2)[0];
        if (!storedOtp.equals(request.getOtp())) {
            throw new BadRequestException("Invalid OTP");
        }

        User existingUser = userRepository.findByEmail(pending.getEmail()).orElse(null);
        if (existingUser != null) {
            if (existingUser.getRole() != Role.CUSTOMER) {
                pendingRegistrationRepository.delete(pending);
                throw new BadRequestException("Email already registered");
            }

            if (Boolean.TRUE.equals(existingUser.getActive())) {
                pendingRegistrationRepository.delete(pending);
                throw new BadRequestException("Email already registered");
            }

            existingUser.setFullName(pending.getFullName());
            existingUser.setPassword(pending.getPassword());
            existingUser.setPhone(pending.getPhone());
            existingUser.setRole(Role.CUSTOMER);
            existingUser.setActive(true);
            userRepository.save(existingUser);
            pendingRegistrationRepository.delete(pending);

            return Map.of("message", "Account reactivated successfully. You can now log in.");
        }

        User user = User.builder()
                .fullName(pending.getFullName())
                .email(pending.getEmail())
                .password(pending.getPassword())
                .phone(pending.getPhone())
                .role(Role.CUSTOMER)
                .active(true)
                .build();

        userRepository.save(user);
        pendingRegistrationRepository.delete(pending);

        return Map.of("message", "Account confirmed successfully. You can now log in.");
    }

    @Transactional
    public Map<String, String> resendRegistrationOtp(ResendRegistrationOtpRequest request) {
        PendingRegistration pending = pendingRegistrationRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadRequestException("No pending registration found. Please register again."));

        User existingUser = userRepository.findByEmail(pending.getEmail()).orElse(null);
        if (existingUser != null) {
            if (existingUser.getRole() != Role.CUSTOMER || Boolean.TRUE.equals(existingUser.getActive())) {
                pendingRegistrationRepository.delete(pending);
                throw new BadRequestException("Email already registered");
            }
        }

        String otp = generateOtp();
        String token = otp + "-" + UUID.randomUUID().toString().replace("-", "");
        pending.setToken(token);
        pending.setExpiresAt(LocalDateTime.now().plusMinutes(CONFIRM_EXPIRY_MINUTES));

        pendingRegistrationRepository.save(pending);

        boolean delivered = sendConfirmationOtpEmail(pending.getEmail(), otp);
        if (!delivered) {
            throw new BadRequestException("Could not send signup OTP email. Please check email configuration and try again.");
        }

        return Map.of("message", "OTP resent to your email.");
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail()).orElse(null);
        if (user == null) {
            if (pendingRegistrationRepository.existsByEmail(request.getEmail())) {
                throw new BadRequestException("Please confirm your email to activate your account");
            }
            throw new BadRequestException("Invalid email or password");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BadRequestException("Invalid email or password");
        }

        if (Boolean.FALSE.equals(user.getActive())) {
            throw new BadRequestException("Your account is deleted. Contact admin.");
        }

        return issueAuthResponse(user.getEmail());
    }

    @Transactional
    public AuthResponse googleLogin(GoogleAuthRequest request) {
        Map<?, ?> tokenInfo = verifyGoogleAccount(request);
        String email = stringValue(tokenInfo.get("email")).toLowerCase();
        String name = stringValue(tokenInfo.get("name"));
        if (email.isBlank()) {
            throw new BadRequestException("Google account did not provide an email address");
        }
        if (!"true".equalsIgnoreCase(stringValue(tokenInfo.get("email_verified")))) {
            throw new BadRequestException("Google email is not verified");
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            pendingRegistrationRepository.findByEmail(email).ifPresent(pendingRegistrationRepository::delete);
            user = User.builder()
                    .fullName(!name.isBlank() ? name : fallbackGoogleName(email))
                    .email(email)
                    .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                    .role(Role.CUSTOMER)
                    .active(true)
                    .build();
            userRepository.save(user);
        } else if (Boolean.FALSE.equals(user.getActive())) {
            throw new BadRequestException("Your account is deleted. Contact admin.");
        } else if ((user.getFullName() == null || user.getFullName().isBlank()) && !name.isBlank()) {
            user.setFullName(name);
            userRepository.save(user);
        }

        return issueAuthResponse(user.getEmail());
    }

    private Map<?, ?> verifyGoogleAccount(GoogleAuthRequest request) {
        String idToken = stringValue(request.getIdToken());
        if (!idToken.isBlank()) {
            return verifyGoogleIdToken(idToken);
        }

        String accessToken = stringValue(request.getAccessToken());
        if (!accessToken.isBlank()) {
            return verifyGoogleAccessToken(accessToken);
        }

        throw new BadRequestException("Google sign-in token is required");
    }

    private Map<?, ?> verifyGoogleIdToken(String idToken) {
        Set<String> allowedClientIds = allowedGoogleClientIds();
        if (allowedClientIds.isEmpty()) {
            throw new BadRequestException("Google sign-in is not configured on the server");
        }

        Map<?, ?> tokenInfo;
        try {
            tokenInfo = restTemplate.getForObject(
                    "https://oauth2.googleapis.com/tokeninfo?id_token={idToken}",
                    Map.class,
                    idToken
            );
        } catch (RestClientException ex) {
            throw new BadRequestException("Google sign-in could not be verified. Please try again.");
        }

        if (tokenInfo == null) {
            throw new BadRequestException("Google sign-in could not be verified. Please try again.");
        }

        String audience = stringValue(tokenInfo.get("aud"));
        if (!allowedClientIds.contains(audience)) {
            throw new BadRequestException("Google client is not allowed for this app");
        }
        return tokenInfo;
    }

    private Map<?, ?> verifyGoogleAccessToken(String accessToken) {
        Set<String> allowedClientIds = allowedGoogleClientIds();
        if (allowedClientIds.isEmpty()) {
            throw new BadRequestException("Google sign-in is not configured on the server");
        }

        Map<?, ?> tokenInfo;
        try {
            tokenInfo = restTemplate.getForObject(
                    "https://oauth2.googleapis.com/tokeninfo?access_token={accessToken}",
                    Map.class,
                    accessToken
            );
        } catch (RestClientException ex) {
            throw new BadRequestException("Google sign-in could not be verified. Please try again.");
        }

        if (tokenInfo == null) {
            throw new BadRequestException("Google sign-in could not be verified. Please try again.");
        }

        String audience = stringValue(tokenInfo.get("aud"));
        if (audience.isBlank()) {
            audience = stringValue(tokenInfo.get("audience"));
        }
        if (!audience.isBlank() && !allowedClientIds.contains(audience)) {
            throw new BadRequestException("Google client is not allowed for this app");
        }

        String scope = stringValue(tokenInfo.get("scope"));
        if (!scope.contains("email")) {
            throw new BadRequestException("Google account email permission was not granted");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    HttpMethod.GET,
                    entity,
                    Map.class
            );
            Map<?, ?> userInfo = response.getBody();
            if (userInfo == null) {
                throw new BadRequestException("Google account details could not be loaded");
            }
            return userInfo;
        } catch (RestClientException ex) {
            throw new BadRequestException("Google account details could not be loaded");
        }
    }

    private Set<String> allowedGoogleClientIds() {
        return Arrays.stream(String.valueOf(googleClientIds).split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toSet());
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String fallbackGoogleName(String email) {
        String local = email.split("@", 2)[0].replace('.', ' ').replace('_', ' ').trim();
        return local.isBlank() ? "Google User" : local;
    }

    public AuthResponse issueAuthResponse(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String token = jwtService.generateToken(user.getEmail(), user.getRole().name(), user.getId());

        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole().name())
                .userId(user.getId())
                .build();
    }

    public UserResponse getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return toUserResponse(user);
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private UserResponse toUserResponse(User user) {
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

    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int otp = 100000 + random.nextInt(900000);
        return String.valueOf(otp);
    }

    private boolean sendConfirmationOtpEmail(String email, String otp) {
        if (mailSender == null) {
            log.warn("JavaMailSender not configured; signup OTP email cannot be sent");
            return false;
        }
        String from = (mailFrom != null && !mailFrom.isBlank()) ? mailFrom : mailUsername;
        if (from == null || from.isBlank()) {
            log.warn("Mail from address not configured; signup OTP email cannot be sent");
            return false;
        }
        if (mailUsername == null || mailUsername.isBlank() || mailPassword == null || mailPassword.isBlank()) {
            log.warn("Mail username/password not configured; signup OTP email cannot be sent");
            return false;
        }
        String html = ""
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111\">"
                + "<p>Use the OTP below to confirm your account:</p>"
                + "<p style=\"font-size:24px;font-weight:700;letter-spacing:6px;margin:12px 0;\">"
                + otp
                + "</p>"
                + "<p>This OTP will expire in " + CONFIRM_EXPIRY_MINUTES + " minutes.</p>"
                + "</div>";

        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, "UTF-8");
            helper.setTo(email);
            helper.setFrom(from);
            helper.setSubject("PLUGIN - Confirm your account");
            helper.setText(html, true);
            mailSender.send(message);
            log.info("Signup confirmation OTP email sent to {}", email);
            return true;
        } catch (Exception e) {
            log.warn("Failed to send signup confirmation OTP email to {}", email, e);
            return false;
        }
    }
}
