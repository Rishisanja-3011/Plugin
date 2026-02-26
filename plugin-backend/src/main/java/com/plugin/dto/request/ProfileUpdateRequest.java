package com.plugin.dto.request;

import lombok.Data;

@Data
public class ProfileUpdateRequest {
    private String fullName;
    private String phone;
    private String vehicleMake;
    private String vehicleModel;
    private String vehicleRegistration;
}
