package com.plugin.entity;

import com.plugin.enums.StationManagerApplicationStatus;
import com.plugin.enums.StationManagerBusinessType;
import com.plugin.enums.StationPropertyOccupancyType;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "stationManagerApplications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationManagerApplication {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    private User user;

    private Station approvedStation;

    private StationManagerApplicationStatus status;

    private String fullName;

    @Indexed(unique = true)
    private String email;

    @Indexed(unique = true, sparse = true)
    private String applicationReferenceId;

    private String phone;

    private LocalDate dateOfBirth;

    private String residentialAddress;

    private String governmentIdType;

    private String governmentIdNumber;

    private String governmentIdDocumentReference;

    private String selfieDocumentReference;

    private StationManagerBusinessType businessType;

    private String businessName;

    private String legalBusinessName;

    private String panNumber;

    private String gstNumber;

    private String businessRegistrationNumber;

    private String businessAddress;

    private String authorizedSignatoryName;

    private String authorizedSignatoryDesignation;

    private String registrationProofReference;

    private String authorizationProofReference;

    @Builder.Default
    private List<StationManagerApplicationDocument> businessDocuments = new ArrayList<>();

    @Builder.Default
    private List<StationManagerApplicationFile> uploadedFiles = new ArrayList<>();

    private String stationName;

    private String stationAddress;

    private String stationCity;

    private String stationState;

    private String stationPincode;

    private Double stationLatitude;

    private Double stationLongitude;

    private StationPropertyOccupancyType propertyOccupancyType;

    private String propertyDocumentReference;

    private String electricityConsumerNumber;

    private String electricityBillReference;

    private LocalTime openingTime;

    private LocalTime closingTime;

    private String emergencyContactNumber;

    private String bankAccountHolderName;

    private String bankName;

    private String bankAccountNumber;

    private String bankIfscCode;

    private String bankProofReference;

    private Integer numberOfChargers;

    private String chargerTypesSummary;

    private String connectorTypesSummary;

    private Double totalCapacityKw;

    private String chargerManufacturerNames;

    private String installationPhotoReference;

    private String sitePhotoReference;

    private LocalDateTime submittedAt;

    private LocalDateTime reviewedAt;

    private String reviewedBy;

    private String reviewNotes;

    private LocalDateTime credentialsIssuedAt;

    private String credentialsIssuedBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (submittedAt == null) {
            submittedAt = now;
        }
    }

    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
