package com.plugin.repository;

import com.plugin.entity.Station;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.util.List;
import java.util.Optional;

public interface StationRepository extends MongoRepository<Station, String>, StationRepositoryCustom {

    Optional<Station> findById(Long id);
    List<Station> findByIdIn(List<Long> ids);
    @Query("{ 'active': { $in: [true, 1] } }")
    Page<Station> findByActiveTrue(Pageable pageable);
    Page<Station> findByManagerId(Long managerId, Pageable pageable);
    List<Station> findByManagerId(Long managerId);
    Optional<Station> findByIdAndManagerId(Long id, Long managerId);

    @Query("{ 'active': { $in: [true, 1] }, 'pincode': ?0 }")
    Page<Station> findByActiveTrueAndPincode(String pincode, Pageable pageable);

    Page<Station> findByPincode(String pincode, Pageable pageable);

    @Query(value = "{ 'active': { $in: [true, 1] } }", count = true)
    long countByActiveTrue();

    long countByManagerId(Long managerId);

    @Query(value = "{ 'managerId': ?0, 'active': { $in: [true, 1] } }", count = true)
    long countByManagerIdAndActiveTrue(Long managerId);

    @Query("{ 'active': { $in: [true, 1] } }")
    List<Station> findByActiveTrue();
}
