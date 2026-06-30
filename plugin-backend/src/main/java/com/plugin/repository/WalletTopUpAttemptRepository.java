package com.plugin.repository;

import com.plugin.entity.WalletTopUpAttempt;
import com.plugin.enums.WalletTransactionStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface WalletTopUpAttemptRepository extends MongoRepository<WalletTopUpAttempt, String> {
    Optional<WalletTopUpAttempt> findByRazorpayOrderId(String razorpayOrderId);
    List<WalletTopUpAttempt> findByCustomerIdAndStatusOrderByCompletedAtDesc(Long customerId, WalletTransactionStatus status);
    void deleteByCustomerId(Long customerId);
}
