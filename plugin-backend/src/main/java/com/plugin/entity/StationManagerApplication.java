package com.plugin.entity;

import com.plugin.enums.StationManagerApplicationStatus;
import com.plugin.enums.StationManagerBusinessType;
import com.plugin.enums.StationPropertyOccupancyType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "station_manager_applications", uniqueConstraints = {
        @UniqueConstraint(columnNames = "user_id"),
        @UniqueConstraint(columnNames = "email"),
        @UniqueConstraint(columnNames = "application_reference_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationManagerApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_station_id")
    private Station approvedStation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StationManagerApplicationStatus status;

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, length = 150)
    private String email;

    @Column(name = "application_reference_id", length = 11, unique = true)
    private String applicationReferenceId;

    @Column(nullable = false, length = 20)
    private String phone;

    private LocalDate dateOfBirth;

    @Column(nullable = false, length = 300)
    private String residentialAddress;

    @Column(nullable = false, length = 50)
    private String governmentIdType;

    @Column(nullable = false, length = 100)
    private String governmentIdNumber;

    @Column(nullable = false, length = 500)
    private String governmentIdDocumentReference;

    @Column(nullable = false, length = 500)
    private String selfieDocumentReference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StationManagerBusinessType businessType;

    @Column(nullable = false, length = 150)
    private String businessName;

    @Column(nullable = false, length = 150)
    private String legalBusinessName;

    @Column(nullable = false, length = 20)
    private String panNumber;

    @Column(length = 20)
    private String gstNumber;

    @Column(length = 100)
    private String businessRegistrationNumber;

    @Column(nullable = false, length = 300)
    private String businessAddress;

    @Column(nullable = false, length = 100)
    private String authorizedSignatoryName;

    @Column(nullable = false, length = 100)
    private String authorizedSignatoryDesignation;

    @Column(nullable = false, length = 500)
    private String registrationProofReference;

    @Column(nullable = false, length = 500)
    private String authorizationProofReference;

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<StationManagerApplicationDocument> businessDocuments = new ArrayList<>();

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<StationManagerApplicationFile> uploadedFiles = new ArrayList<>();

    @Column(nullable = false, length = 150)
    private String stationName;

    @Column(nullable = false, length = 300)
    private String stationAddress;

    @Column(nullable = false, length = 100)
    private String stationCity;

    @Column(nullable = false, length = 100)
    private String stationState;

    @Column(nullable = false, length = 10)
    private String stationPincode;

    @Column(nullable = false)
    private Double stationLatitude;

    @Column(nullable = false)
    private Double stationLongitude;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StationPropertyOccupancyType propertyOccupancyType;

    @Column(nullable = false, length = 500)
    private String propertyDocumentReference;

    @Column(nullable = false, length = 100)
    private String electricityConsumerNumber;

    @Column(nullable = false, length = 500)
    private String electricityBillReference;

    @Column(nullable = false)
    private LocalTime openingTime;

    @Column(nullable = false)
    private LocalTime closingTime;

    @Column(nullable = false, length = 20)
    private String emergencyContactNumber;

    @Column(nullable = false, length = 100)
    private String bankAccountHolderName;

    @Column(nullable = false, length = 100)
    private String bankName;

    @Column(nullable = false, length = 30)
    private String bankAccountNumber;

    @Column(nullable = false, length = 20)
    private String bankIfscCode;

    @Column(nullable = false, length = 500)
    private String bankProofReference;

    @Column(nullable = false)
    private Integer numberOfChargers;

    @Column(nullable = false, length = 500)
    private String chargerTypesSummary;

    @Column(nullable = false, length = 500)
    private String connectorTypesSummary;

    @Column(nullable = false)
    private Double totalCapacityKw;

    @Column(nullable = false, length = 500)
    private String chargerManufacturerNames;

    @Column(nullable = false, length = 500)
    private String installationPhotoReference;

    @Column(nullable = false, length = 500)
    private String sitePhotoReference;

    @Column(nullable = false)
    private LocalDateTime submittedAt;

    private LocalDateTime reviewedAt;

    @Column(length = 150)
    private String reviewedBy;

    @Column(length = 500)
    private String reviewNotes;

    private LocalDateTime credentialsIssuedAt;

    @Column(length = 150)
    private String credentialsIssuedBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (submittedAt == null) {
            submittedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
