package com.plugin.entity;

import com.plugin.enums.StationManagerApplicationStatus;
import com.plugin.enums.StationManagerBusinessType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "stationManagers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationManager {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    @Indexed(unique = true)
    private Long applicationId;

    @Indexed(sparse = true)
    private Long userId;

    private Long approvedStationId;

    private String applicationReferenceId;

    private String fullName;

    @Indexed
    private String email;

    private String portalEmail;

    private String phone;

    private StationManagerApplicationStatus status;

    private StationManagerBusinessType businessType;

    private String businessName;

    private String stationName;

    private String stationCity;

    private String stationState;

    private Boolean portalAccessReady;

    private LocalDateTime submittedAt;

    private LocalDateTime reviewedAt;

    private LocalDateTime credentialsIssuedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
