package com.plugin.dto.request;

import lombok.Data;

@Data
public class ProfileVehicleRequest {
    private Long id;
    private String vehicleMake;
    private String vehicleModel;
    private String vehicleRegistration;
    private Boolean active;
}
