package com.plugin.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "userVehicles")
@CompoundIndex(name = "uq_user_vehicle_registration", def = "{'user.id': 1, 'vehicleRegistration': 1}", unique = true)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserVehicle {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    @Indexed
    private User user;

    private Long userId;

    private String vehicleMake;

    private String vehicleModel;

    private String vehicleRegistration;

    private String vehicleNickname;

    @Indexed
    private Boolean active;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (active == null) {
            active = false;
        }
    }

    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
