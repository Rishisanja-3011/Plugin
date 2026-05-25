package com.plugin.repository;

import com.plugin.entity.StationManagerApplication;
import com.plugin.enums.StationManagerApplicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface StationManagerApplicationRepository extends MongoRepository<StationManagerApplication, String>, StationManagerApplicationRepositoryCustom {
    Optional<StationManagerApplication> findById(Long id);
    Optional<StationManagerApplication> findByUserId(Long userId);
    Optional<StationManagerApplication> findByEmailIgnoreCase(String email);
    Optional<StationManagerApplication> findByApplicationReferenceId(String applicationReferenceId);
    Optional<StationManagerApplication> findByApprovedStationId(Long approvedStationId);
    List<StationManagerApplication> findByStatus(StationManagerApplicationStatus status);
    boolean existsByApplicationReferenceId(String applicationReferenceId);
}
