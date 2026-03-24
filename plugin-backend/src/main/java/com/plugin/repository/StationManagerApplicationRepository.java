package com.plugin.repository;

import com.plugin.entity.StationManagerApplication;
import com.plugin.enums.StationManagerApplicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface StationManagerApplicationRepository extends JpaRepository<StationManagerApplication, Long> {
    Optional<StationManagerApplication> findByUserId(Long userId);
    Optional<StationManagerApplication> findByEmailIgnoreCase(String email);
    Optional<StationManagerApplication> findByApplicationReferenceId(String applicationReferenceId);
    Optional<StationManagerApplication> findByApprovedStationId(Long approvedStationId);
    boolean existsByApplicationReferenceId(String applicationReferenceId);

    @Query("""
            SELECT a FROM StationManagerApplication a
            WHERE (:status IS NULL OR a.status = :status)
              AND (:linkedStationOnly = false OR a.approvedStation IS NOT NULL)
              AND (
                :query IS NULL OR :query = '' OR
                a.applicationReferenceId LIKE CONCAT('%', :query, '%') OR
                LOWER(a.fullName) LIKE LOWER(CONCAT('%', :query, '%')) OR
                LOWER(a.email) LIKE LOWER(CONCAT('%', :query, '%')) OR
                LOWER(a.businessName) LIKE LOWER(CONCAT('%', :query, '%')) OR
                LOWER(a.stationName) LIKE LOWER(CONCAT('%', :query, '%'))
              )
            """)
    Page<StationManagerApplication> search(@Param("status") StationManagerApplicationStatus status,
                                           @Param("query") String query,
                                           @Param("linkedStationOnly") boolean linkedStationOnly,
                                           Pageable pageable);
}
