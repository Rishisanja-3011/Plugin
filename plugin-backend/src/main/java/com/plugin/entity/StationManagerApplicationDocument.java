package com.plugin.entity;

import com.plugin.enums.StationManagerBusinessDocumentType;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "stationManagerApplicationDocuments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationManagerApplicationDocument {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    private Long applicationId;

    @Transient
    private StationManagerApplication application;

    private StationManagerBusinessDocumentType documentType;

    private String referenceNumber;

    private String documentReference;

    private String notes;

    public void setApplication(StationManagerApplication application) {
        this.application = application;
        this.applicationId = application == null ? null : application.getId();
    }
}
