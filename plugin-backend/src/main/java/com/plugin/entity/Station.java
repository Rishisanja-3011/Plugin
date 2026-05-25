package com.plugin.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Document(collection = "stations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Station {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    private String name;

    private String address;

    private String city;

    private String state;

    private String pincode;

    private String contactPhone;

    private String contactEmail;

    private User manager;

    private Long managerId;

    private Double latitude;

    private Double longitude;

    private LocalTime openingTime;

    private LocalTime closingTime;

    private Boolean active;

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
