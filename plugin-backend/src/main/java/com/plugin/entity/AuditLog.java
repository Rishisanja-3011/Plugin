package com.plugin.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "auditLogs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    private String action;

    private String entityType;

    private Long entityId;

    private String performedBy;

    private String details;

    private LocalDateTime createdAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
