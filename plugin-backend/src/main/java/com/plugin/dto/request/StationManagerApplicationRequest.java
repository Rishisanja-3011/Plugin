package com.plugin.dto.request;

import com.plugin.enums.StationManagerBusinessType;
import com.plugin.enums.StationPropertyOccupancyType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class StationManagerApplicationRequest {
    @NotBlank
    private String fullName;

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String phone;

    @NotNull
    private LocalDate dateOfBirth;

    @NotBlank
    private String residentialAddress;

    @NotBlank
    private String governmentIdType;

    @NotBlank
    private String governmentIdNumber;

    private String governmentIdDocumentReference;

    private String selfieDocumentReference;

    @NotNull
    private StationManagerBusinessType businessType;

    @NotBlank
    private String businessName;

    @NotBlank
    private String legalBusinessName;

    @NotBlank
    private String panNumber;

    private String gstNumber;

    private String businessRegistrationNumber;

    @NotBlank
    private String businessAddress;

    @NotBlank
    private String authorizedSignatoryName;

    @NotBlank
    private String authorizedSignatoryDesignation;

    private String registrationProofReference;

    private String authorizationProofReference;

    @Valid
    private List<StationManagerDocumentRequest> businessDocuments = new ArrayList<>();

    @NotBlank
    private String stationName;

    @NotBlank
    private String stationAddress;

    @NotBlank
    private String stationCity;

    @NotBlank
    private String stationState;

    @NotBlank
    private String stationPincode;

    @NotNull
    private Double stationLatitude;

    @NotNull
    private Double stationLongitude;

    @NotNull
    private StationPropertyOccupancyType propertyOccupancyType;

    private String propertyDocumentReference;

    @NotBlank
    private String electricityConsumerNumber;

    private String electricityBillReference;

    @NotNull
    private LocalTime openingTime;

    @NotNull
    private LocalTime closingTime;

    @NotBlank
    private String emergencyContactNumber;

    @NotBlank
    private String bankAccountHolderName;

    @NotBlank
    private String bankName;

    @NotBlank
    private String bankAccountNumber;

    @NotBlank
    private String bankIfscCode;

    private String bankProofReference;

    @NotNull
    @Min(1)
    private Integer numberOfChargers;

    @NotBlank
    private String chargerTypesSummary;

    @NotBlank
    private String connectorTypesSummary;

    @NotNull
    @DecimalMin("0.1")
    private Double totalCapacityKw;

    @NotBlank
    private String chargerManufacturerNames;

    private String installationPhotoReference;

    private String sitePhotoReference;
}
