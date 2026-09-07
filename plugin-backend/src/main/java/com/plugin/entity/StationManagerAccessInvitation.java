package com.plugin.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "stationManagerAccessInvitations")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StationManagerAccessInvitation {

    @Id
    private String id;

    @Indexed(unique = true)
    private String tokenHash;

    @Indexed
    private Long applicationId;

    private Long userId;

    private String createdBy;

    @Indexed(expireAfter = "0s")
    private LocalDateTime expiresAt;

    private LocalDateTime usedAt;

    private LocalDateTime createdAt;

    @Version
    private Long version;
}
