package com.plugin.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "pendingRegistrations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PendingRegistration {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    private String fullName;

    @Indexed(unique = true)
    private String email;

    private String password;

    private String phone;

    @Indexed(unique = true)
    private String token;

    private LocalDateTime expiresAt;

    private LocalDateTime createdAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
