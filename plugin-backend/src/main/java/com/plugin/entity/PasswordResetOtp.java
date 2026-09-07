package com.plugin.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "passwordResetOtps")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PasswordResetOtp {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    private String email;

    private String otpHash;

    private String deliveryMethod;

    private String purpose;

    @Indexed(expireAfter = "0s")
    private LocalDateTime expiresAt;

    private boolean used;

    @Builder.Default
    private int failedAttempts = 0;

    private LocalDateTime createdAt;

    @Version
    private Long version;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
