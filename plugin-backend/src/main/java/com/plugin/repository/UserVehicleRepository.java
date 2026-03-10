package com.plugin.repository;

import com.plugin.entity.UserVehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserVehicleRepository extends JpaRepository<UserVehicle, Long> {

    List<UserVehicle> findByUserIdOrderByActiveDescCreatedAtDesc(Long userId);

    Optional<UserVehicle> findFirstByUserIdAndActiveTrue(Long userId);

    void deleteByUserId(Long userId);
}
