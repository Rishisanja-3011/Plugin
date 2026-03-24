package com.plugin.entity;

import com.plugin.enums.StationManagerBusinessDocumentType;
import com.plugin.enums.StationManagerFileSlot;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "station_manager_application_files")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StationManagerApplicationFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private StationManagerApplication application;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private StationManagerFileSlot slotType;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private StationManagerBusinessDocumentType businessDocumentType;

    @Column(nullable = false, length = 255)
    private String originalFileName;

    @Column(length = 100)
    private String contentType;

    @Column(nullable = false)
    private Long fileSize;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGBLOB")
    private byte[] fileData;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
