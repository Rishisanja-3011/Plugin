package com.plugin.repository;

import com.plugin.entity.WalletLedgerEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface WalletLedgerEntryRepository extends MongoRepository<WalletLedgerEntry, String> {
    Page<WalletLedgerEntry> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);
    void deleteByCustomerId(Long customerId);
}
