package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data @Builder
public class StationResponse {
    private Long id;
    private String name;
    private String address;
    private String city;
    private String state;
    private String pincode;
    private String contactPhone;
    private String contactEmail;
    private Long managerId;
    private String managerName;
    private Double latitude;
    private Double longitude;
    private LocalTime openingTime;
    private LocalTime closingTime;
    private Boolean active;
    private LocalDateTime createdAt;
    private long totalPoints;
    private long availablePoints;
}
