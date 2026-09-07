package com.plugin.entity;

import com.plugin.enums.Role;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    private String fullName;

    @Indexed(unique = true)
    private String email;

    private String password;

    private String phone;

    /** Provider subject used to prevent privileged Google sign-in from being linked by email alone. */
    private String googleSubject;

    private Role role;

    private Boolean active;

    /**
     * Incrementing this value invalidates every JWT issued for the previous value.
     * Missing values on pre-existing Mongo documents are treated as zero.
     */
    @Builder.Default
    private Long tokenVersion = 0L;

    private String vehicleMake;

    private String vehicleModel;

    private String vehicleRegistration;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (active == null) active = true;
        if (tokenVersion == null) tokenVersion = 0L;
    }

    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public long currentTokenVersion() {
        return tokenVersion == null ? 0L : tokenVersion;
    }

    public void revokeSessions() {
        tokenVersion = currentTokenVersion() + 1L;
    }
}
