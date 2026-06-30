package com.plugin.repository;

import com.plugin.entity.Wallet;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface WalletRepository extends MongoRepository<Wallet, String> {
    Optional<Wallet> findById(Long id);
    Optional<Wallet> findByCustomerId(Long customerId);
    boolean existsByCustomerId(Long customerId);
    void deleteByCustomerId(Long customerId);
}
