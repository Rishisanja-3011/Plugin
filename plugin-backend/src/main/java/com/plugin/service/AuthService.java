package com.plugin.service;

import com.plugin.config.JwtService;
import com.plugin.config.IdentityNormalizer;
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
import com.plugin.exception.RateLimitExceededException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.PendingRegistrationRepository;
import com.plugin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.security.SecureRandom;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.UUID;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PendingRegistrationRepository pendingRegistrationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OtpSecurityService otpSecurityService;
    private final MongoTemplate mongoTemplate;
    private final RestTemplateBuilder restTemplateBuilder;
    private final SecurityRateLimitService securityRateLimitService;
    private RestTemplate restTemplate;
    private String dummyPasswordHash;

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

    @Value("${app.google.connect-timeout-ms:5000}")
    private int googleConnectTimeoutMs;

    @Value("${app.google.read-timeout-ms:5000}")
    private int googleReadTimeoutMs;

    private static final int CONFIRM_EXPIRY_MINUTES = 10;
    private static final Map<String, String> GENERIC_REGISTRATION_RESPONSE = Map.of(
            "message", "If this email can be registered, a confirmation code will be sent.");

    @PostConstruct
    void initializeSecurityClients() {
        if (googleConnectTimeoutMs < 100 || googleConnectTimeoutMs > 30_000
                || googleReadTimeoutMs < 100 || googleReadTimeoutMs > 30_000) {
            throw new IllegalStateException("Google HTTP timeouts must be between 100 and 30000 milliseconds");
        }
        restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofMillis(googleConnectTimeoutMs))
                .setReadTimeout(Duration.ofMillis(googleReadTimeoutMs))
                .build();
        dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    public Map<String, String> register(RegisterRequest request) {
        String normalizedEmail = IdentityNormalizer.email(request.getEmail());
        User existingUser = userRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (existingUser != null) {
            if (existingUser.getRole() != Role.CUSTOMER) {
                return GENERIC_REGISTRATION_RESPONSE;
            }
            if (Boolean.TRUE.equals(existingUser.getActive())) {
                return GENERIC_REGISTRATION_RESPONSE;
            }
        }

        LocalDateTime now = LocalDateTime.now();
        String otp = generateOtp();
        LocalDateTime expiresAt = now.plusMinutes(CONFIRM_EXPIRY_MINUTES);

        PendingRegistration pending = pendingRegistrationRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElse(PendingRegistration.builder().build());
        try {
            otpSecurityService.enforceResendCooldown(pending.getLastSentAt(), now);
        } catch (BadRequestException ex) {
            return GENERIC_REGISTRATION_RESPONSE;
        }

        pending.setFullName(request.getFullName());
        pending.setEmail(normalizedEmail);
        pending.setPassword(passwordEncoder.encode(request.getPassword()));
        pending.setPhone(request.getPhone());
        pending.setOtpHash(otpSecurityService.hash(
                normalizedEmail, OtpSecurityService.PURPOSE_REGISTRATION, otp));
        pending.setFailedAttempts(0);
        pending.setUsed(false);
        pending.setLastSentAt(now);
        pending.setExpiresAt(expiresAt);

        pending = pendingRegistrationRepository.save(pending);

        boolean delivered = sendConfirmationOtpEmail(pending.getEmail(), otp);
        if (!delivered) {
            // Keep the pending registration so the user can retry delivery after
            // a temporary SMTP outage instead of being stranded on the OTP screen.
            log.warn("Signup OTP delivery failed; pending registration retained for resend");
        }

        return GENERIC_REGISTRATION_RESPONSE;
    }

    @Transactional
    public Map<String, String> confirmRegistrationOtp(ConfirmRegistrationOtpRequest request) {
        String normalizedEmail = IdentityNormalizer.email(request.getEmail());
        PendingRegistration pending = pendingRegistrationRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new BadRequestException("OTP expired or not found. Please register again."));

        if (pending.getExpiresAt().isBefore(LocalDateTime.now())) {
            pendingRegistrationRepository.delete(pending);
            throw new BadRequestException("OTP expired. Please register again.");
        }

        if (pending.isUsed() || pending.getFailedAttempts() >= otpSecurityService.maxAttempts()) {
            throw new BadRequestException("OTP expired or locked. Please request a new one.");
        }
        if (!otpSecurityService.matches(pending.getOtpHash(), pending.getEmail(),
                OtpSecurityService.PURPOSE_REGISTRATION, request.getOtp())) {
            recordRegistrationOtpFailure(pending);
            throw new BadRequestException("Invalid OTP");
        }

        pending = claimRegistrationOtp(pending, request.getOtp());

        User existingUser = userRepository.findByEmailIgnoreCase(pending.getEmail()).orElse(null);
        if (existingUser != null) {
            if (existingUser.getRole() != Role.CUSTOMER) {
                pendingRegistrationRepository.delete(pending);
                throw new BadRequestException("Email already registered");
            }

            if (Boolean.TRUE.equals(existingUser.getActive())) {
                pendingRegistrationRepository.delete(pending);
                throw new BadRequestException("Email already registered");
            }

            existingUser.revokeSessions();
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
        String normalizedEmail = IdentityNormalizer.email(request.getEmail());
        PendingRegistration pending = pendingRegistrationRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElse(null);
        if (pending == null) {
            return GENERIC_REGISTRATION_RESPONSE;
        }

        User existingUser = userRepository.findByEmailIgnoreCase(pending.getEmail()).orElse(null);
        if (existingUser != null) {
            if (existingUser.getRole() != Role.CUSTOMER || Boolean.TRUE.equals(existingUser.getActive())) {
                pendingRegistrationRepository.delete(pending);
                return GENERIC_REGISTRATION_RESPONSE;
            }
        }

        LocalDateTime now = LocalDateTime.now();
        try {
            otpSecurityService.enforceResendCooldown(pending.getLastSentAt(), now);
        } catch (BadRequestException ex) {
            return GENERIC_REGISTRATION_RESPONSE;
        }
        String otp = generateOtp();
        pending.setOtpHash(otpSecurityService.hash(
                pending.getEmail(), OtpSecurityService.PURPOSE_REGISTRATION, otp));
        pending.setFailedAttempts(0);
        pending.setUsed(false);
        pending.setLastSentAt(now);
        pending.setExpiresAt(now.plusMinutes(CONFIRM_EXPIRY_MINUTES));

        pendingRegistrationRepository.save(pending);

        boolean delivered = sendConfirmationOtpEmail(pending.getEmail(), otp);
        if (!delivered) {
            return GENERIC_REGISTRATION_RESPONSE;
        }

        return GENERIC_REGISTRATION_RESPONSE;
    }

    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = IdentityNormalizer.email(request.getEmail());
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
        String passwordHash = user == null ? dummyPasswordHash : user.getPassword();
        boolean passwordMatches = passwordEncoder.matches(request.getPassword(), passwordHash);
        if (user == null || !passwordMatches || !Boolean.TRUE.equals(user.getActive())) {
            throw new BadRequestException("Invalid email or password");
        }

        return issueAuthResponse(user.getEmail());
    }

    @Transactional
    public AuthResponse googleLogin(GoogleAuthRequest request) {
        Map<?, ?> tokenInfo = verifyGoogleAccount(request);
        String email = stringValue(tokenInfo.get("email")).toLowerCase(Locale.ROOT);
        String name = stringValue(tokenInfo.get("name"));
        String googleSubject = stringValue(tokenInfo.get("sub"));
        if (email.isBlank()) {
            throw new BadRequestException("Google account did not provide an email address");
        }
        if (googleSubject.isBlank()) {
            throw new BadRequestException("Google sign-in could not be verified. Please try again.");
        }
        if (!"true".equalsIgnoreCase(stringValue(tokenInfo.get("email_verified")))) {
            throw new BadRequestException("Google email is not verified");
        }
        SecurityRateLimitService.Decision accountLimit = securityRateLimitService.consume(
                "auth-google-verified", "account", email, 20, Duration.ofMinutes(1));
        if (!accountLimit.permitted()) {
            throw new RateLimitExceededException(accountLimit.retryAfterSeconds());
        }

        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (user == null) {
            pendingRegistrationRepository.findByEmailIgnoreCase(email)
                    .ifPresent(pendingRegistrationRepository::delete);
            user = User.builder()
                    .fullName(!name.isBlank() ? name : fallbackGoogleName(email))
                    .email(email)
                    .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                    .googleSubject(googleSubject)
                    .role(Role.CUSTOMER)
                    .active(true)
                    .build();
            userRepository.save(user);
        } else if (Boolean.FALSE.equals(user.getActive())) {
            throw new BadRequestException("Your account is deleted. Contact admin.");
        } else {
            boolean privileged = user.getRole() != Role.CUSTOMER;
            if (privileged && (user.getGoogleSubject() == null
                    || !sameGoogleSubject(user.getGoogleSubject(), googleSubject))) {
                throw new BadRequestException("Google sign-in is not linked to this privileged account");
            }
            if (user.getGoogleSubject() != null
                    && !sameGoogleSubject(user.getGoogleSubject(), googleSubject)) {
                throw new BadRequestException("Google sign-in could not be verified. Please try again.");
            }
            boolean changed = false;
            if (!privileged && (user.getGoogleSubject() == null || user.getGoogleSubject().isBlank())) {
                user.setGoogleSubject(googleSubject);
                changed = true;
            }
            if ((user.getFullName() == null || user.getFullName().isBlank()) && !name.isBlank()) {
                user.setFullName(name);
                changed = true;
            }
            if (changed) {
                userRepository.save(user);
            }
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
        String issuer = stringValue(tokenInfo.get("iss"));
        if (!"accounts.google.com".equals(issuer)
                && !"https://accounts.google.com".equals(issuer)) {
            throw new BadRequestException("Google sign-in could not be verified. Please try again.");
        }
        String authorizedParty = stringValue(tokenInfo.get("azp"));
        if (!authorizedParty.isBlank() && !allowedClientIds.contains(authorizedParty)) {
            throw new BadRequestException("Google client is not allowed for this app");
        }
        long expiresAt = parseLong(tokenInfo.get("exp"));
        if (expiresAt <= java.time.Instant.now().getEpochSecond()) {
            throw new BadRequestException("Google sign-in could not be verified. Please try again.");
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

        Set<String> clientClaims = java.util.stream.Stream.of(
                        stringValue(tokenInfo.get("aud")),
                        stringValue(tokenInfo.get("audience")),
                        stringValue(tokenInfo.get("issued_to")))
                .filter(value -> !value.isBlank())
                .collect(Collectors.toSet());
        if (clientClaims.isEmpty() || !allowedClientIds.containsAll(clientClaims)) {
            throw new BadRequestException("Google client is not allowed for this app");
        }

        String scope = stringValue(tokenInfo.get("scope"));
        Set<String> scopes = Arrays.stream(scope.split("\\s+"))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toSet());
        if (!scopes.contains("email")
                && !scopes.contains("https://www.googleapis.com/auth/userinfo.email")) {
            throw new BadRequestException("Google account email permission was not granted");
        }
        if (parseLong(tokenInfo.get("expires_in")) <= 0L) {
            throw new BadRequestException("Google sign-in could not be verified. Please try again.");
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

    private long parseLong(Object value) {
        try {
            return Long.parseLong(stringValue(value));
        } catch (NumberFormatException ex) {
            return -1L;
        }
    }

    private boolean sameGoogleSubject(String expected, String actual) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }

    private String fallbackGoogleName(String email) {
        String local = email.split("@", 2)[0].replace('.', ' ').replace('_', ' ').trim();
        return local.isBlank() ? "Google User" : local;
    }

    public AuthResponse issueAuthResponse(String email) {
        User user = userRepository.findByEmailIgnoreCase(IdentityNormalizer.email(email))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!Boolean.TRUE.equals(user.getActive()) || user.getRole() == null) {
            throw new BadRequestException("Account is not active");
        }

        String token = jwtService.generateToken(
                user.getEmail(), user.getRole().name(), user.getId(), user.currentTokenVersion());

        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole().name())
                .userId(user.getId())
                .build();
    }

    public UserResponse getProfile(String email) {
        User user = userRepository.findByEmailIgnoreCase(IdentityNormalizer.email(email))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return toUserResponse(user);
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(IdentityNormalizer.email(email))
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
            log.info("Signup confirmation OTP email sent");
            return true;
        } catch (Exception e) {
            log.warn("Failed to send signup confirmation OTP email; type={}", e.getClass().getName());
            return false;
        }
    }

    private void recordRegistrationOtpFailure(PendingRegistration pending) {
        Query query = Query.query(Criteria.where("_id").is(pending.getMongoId())
                .and("used").is(false)
                .and("expiresAt").gt(LocalDateTime.now())
                .and("failedAttempts").lt(otpSecurityService.maxAttempts()));
        mongoTemplate.updateFirst(query, new Update().inc("failedAttempts", 1), PendingRegistration.class);
    }

    private PendingRegistration claimRegistrationOtp(PendingRegistration pending, String otp) {
        String expectedHash = otpSecurityService.hash(
                pending.getEmail(), OtpSecurityService.PURPOSE_REGISTRATION, otp);
        Query query = Query.query(Criteria.where("_id").is(pending.getMongoId())
                .and("used").is(false)
                .and("expiresAt").gt(LocalDateTime.now())
                .and("failedAttempts").lt(otpSecurityService.maxAttempts())
                .and("otpHash").is(expectedHash));
        PendingRegistration claimed = mongoTemplate.findAndModify(
                query,
                new Update().set("used", true),
                FindAndModifyOptions.options().returnNew(true),
                PendingRegistration.class
        );
        if (claimed == null) {
            throw new BadRequestException("OTP expired, used, or locked. Please request a new one.");
        }
        return claimed;
    }
}
