package com.plugin.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class ProfileUpdateRequest {
    private String fullName;
    private String phone;
    private String vehicleMake;
    private String vehicleModel;
    private String vehicleRegistration;
    private List<ProfileVehicleRequest> vehicles;
    private Long activeVehicleId;
}
