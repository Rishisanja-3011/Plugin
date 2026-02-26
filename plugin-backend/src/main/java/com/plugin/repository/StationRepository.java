package com.plugin.repository;

import com.plugin.entity.Station;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface StationRepository extends JpaRepository<Station, Long> {

    Page<Station> findByActiveTrue(Pageable pageable);

    Page<Station> findByActiveTrueAndPincode(String pincode, Pageable pageable);

    @Query("SELECT s FROM Station s WHERE s.active = true AND " +
           "(LOWER(s.city) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(s.pincode) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(s.address) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Station> searchStations(@Param("query") String query, Pageable pageable);

    long countByActiveTrue();

    List<Station> findByActiveTrue();
}
