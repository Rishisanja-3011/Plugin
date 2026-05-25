package com.plugin.repository;

import com.plugin.entity.UserVehicle;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UserVehicleRepository extends MongoRepository<UserVehicle, String> {

    Optional<UserVehicle> findById(Long id);
    List<UserVehicle> findByIdIn(List<Long> ids);

    List<UserVehicle> findByUserIdOrderByActiveDescCreatedAtDesc(Long userId);

    Optional<UserVehicle> findFirstByUserIdOrderByCreatedAtAscIdAsc(Long userId);

    @Query("{ 'userId': ?0, 'active': { $in: [true, 1] } }")
    Optional<UserVehicle> findFirstByUserIdAndActiveTrue(Long userId);

    Optional<UserVehicle> findByIdAndUserId(Long id, Long userId);

    void deleteByUserId(Long userId);
}
