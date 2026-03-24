package com.plugin.entity;

import com.plugin.enums.StationManagerBusinessDocumentType;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "station_manager_application_documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationManagerApplicationDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private StationManagerApplication application;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private StationManagerBusinessDocumentType documentType;

    @Column(length = 100)
    private String referenceNumber;

    @Column(nullable = false, length = 500)
    private String documentReference;

    @Column(length = 300)
    private String notes;
}
