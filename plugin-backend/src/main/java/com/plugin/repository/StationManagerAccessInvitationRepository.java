package com.plugin.repository;

import com.plugin.entity.StationManagerAccessInvitation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface StationManagerAccessInvitationRepository
        extends MongoRepository<StationManagerAccessInvitation, String> {

    Optional<StationManagerAccessInvitation> findByTokenHashAndUsedAtIsNullAndExpiresAtAfter(
            String tokenHash,
            LocalDateTime now
    );

    List<StationManagerAccessInvitation> findByApplicationIdAndUsedAtIsNull(Long applicationId);
}
