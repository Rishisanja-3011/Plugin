package com.plugin.repository;

import com.plugin.entity.PendingRegistration;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PendingRegistrationRepository extends MongoRepository<PendingRegistration, String> {
    Optional<PendingRegistration> findByEmail(String email);
    Optional<PendingRegistration> findByEmailIgnoreCase(String email);
    boolean existsByEmail(String email);
}
