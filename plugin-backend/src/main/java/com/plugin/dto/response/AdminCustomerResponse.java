package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AdminCustomerResponse {
    private Long id;
    private String fullName;
    private String email;
    private String phone;
    private String vehicleMake;
    private String vehicleModel;
    private String vehicleRegistration;
    private boolean active;
    private LocalDateTime createdAt;
    private long totalBookings;
    private long completedBookings;
    private long cancelledBookings;
    private long activeBookings;
}
