package com.plugin.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    private User user;

    private Long userId;

    private String title;

    private String message;

    private Boolean isRead;

    private LocalDateTime createdAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isRead == null) isRead = false;
    }
}
