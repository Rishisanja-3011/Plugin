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
    @Size(max = 120)
    private String fullName;

    @NotBlank
    @Email
    @Size(max = 254)
    private String email;

    @NotBlank
    @Size(max = 20)
    private String phone;

    @NotNull
    @Past
    private LocalDate dateOfBirth;

    @NotBlank
    @Size(max = 500)
    private String residentialAddress;

    @NotBlank
    @Size(max = 50)
    private String governmentIdType;

    @NotBlank
    @Size(max = 64)
    private String governmentIdNumber;

    @Size(max = 200)
    private String governmentIdDocumentReference;

    @Size(max = 200)
    private String selfieDocumentReference;

    @NotNull
    private StationManagerBusinessType businessType;

    @NotBlank
    @Size(max = 160)
    private String businessName;

    @NotBlank
    @Size(max = 200)
    private String legalBusinessName;

    @NotBlank
    @Size(max = 20)
    private String panNumber;

    @Size(max = 20)
    private String gstNumber;

    @Size(max = 100)
    private String businessRegistrationNumber;

    @NotBlank
    @Size(max = 500)
    private String businessAddress;

    @NotBlank
    @Size(max = 120)
    private String authorizedSignatoryName;

    @NotBlank
    @Size(max = 100)
    private String authorizedSignatoryDesignation;

    @Size(max = 200)
    private String registrationProofReference;

    @Size(max = 200)
    private String authorizationProofReference;

    @Valid
    @Size(max = 20)
    private List<StationManagerDocumentRequest> businessDocuments = new ArrayList<>();

    @NotBlank
    @Size(max = 160)
    private String stationName;

    @NotBlank
    @Size(max = 500)
    private String stationAddress;

    @NotBlank
    @Size(max = 100)
    private String stationCity;

    @NotBlank
    @Size(max = 100)
    private String stationState;

    @NotBlank
    @Size(max = 12)
    private String stationPincode;

    @NotNull
    @DecimalMin("-90.0")
    @DecimalMax("90.0")
    private Double stationLatitude;

    @NotNull
    @DecimalMin("-180.0")
    @DecimalMax("180.0")
    private Double stationLongitude;

    @NotNull
    private StationPropertyOccupancyType propertyOccupancyType;

    @Size(max = 200)
    private String propertyDocumentReference;

    @NotBlank
    @Size(max = 100)
    private String electricityConsumerNumber;

    @Size(max = 200)
    private String electricityBillReference;

    @NotNull
    private LocalTime openingTime;

    @NotNull
    private LocalTime closingTime;

    @NotBlank
    @Size(max = 20)
    private String emergencyContactNumber;

    @NotBlank
    @Size(max = 120)
    private String bankAccountHolderName;

    @NotBlank
    @Size(max = 120)
    private String bankName;

    @NotBlank
    @Size(max = 34)
    private String bankAccountNumber;

    @NotBlank
    @Size(max = 20)
    private String bankIfscCode;

    @Size(max = 200)
    private String bankProofReference;

    @NotNull
    @Min(1)
    @Max(1000)
    private Integer numberOfChargers;

    @NotBlank
    @Size(max = 500)
    private String chargerTypesSummary;

    @NotBlank
    @Size(max = 500)
    private String connectorTypesSummary;

    @NotNull
    @DecimalMin("0.1")
    @DecimalMax("100000.0")
    private Double totalCapacityKw;

    @NotBlank
    @Size(max = 500)
    private String chargerManufacturerNames;

    @Size(max = 200)
    private String installationPhotoReference;

    @Size(max = 200)
    private String sitePhotoReference;
}
