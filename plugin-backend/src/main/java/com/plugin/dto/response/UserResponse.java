package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data @Builder
public class UserResponse {
    private Long id;
    private String fullName;
    private String email;
    private String phone;
    private String role;
    private String vehicleMake;
    private String vehicleModel;
    private String vehicleRegistration;
    private List<ProfileVehicleResponse> vehicles;
    private Long activeVehicleId;
    private LocalDateTime createdAt;
}
