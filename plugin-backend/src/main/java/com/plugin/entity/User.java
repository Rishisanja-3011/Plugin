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

    private Role role;

    private Boolean active;

    private String vehicleMake;

    private String vehicleModel;

    private String vehicleRegistration;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (active == null) active = true;
    }

    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
