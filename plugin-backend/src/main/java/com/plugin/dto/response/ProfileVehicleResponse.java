package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ProfileVehicleResponse {
    private Long id;
    private String vehicleMake;
    private String vehicleModel;
    private String vehicleRegistration;
    private boolean active;
}
