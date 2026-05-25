package com.plugin.entity;

import com.plugin.enums.StationManagerBusinessDocumentType;
import com.plugin.enums.StationManagerFileSlot;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "stationManagerApplicationFiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationManagerApplicationFile {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    private Long applicationId;

    @Transient
    private StationManagerApplication application;

    private StationManagerFileSlot slotType;

    private StationManagerBusinessDocumentType businessDocumentType;

    private String originalFileName;

    private String contentType;

    private Long fileSize;

    private byte[] fileData;

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

    public void setApplication(StationManagerApplication application) {
        this.application = application;
        this.applicationId = application == null ? null : application.getId();
    }
}
