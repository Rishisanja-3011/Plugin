package com.plugin.repository;

import com.plugin.entity.Bill;
import com.plugin.enums.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BillRepository extends MongoRepository<Bill, String>, BillRepositoryCustom {

    Optional<Bill> findById(Long id);
    Page<Bill> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);

    Page<Bill> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Optional<Bill> findByIdAndCustomerId(Long id, Long customerId);

    long countByPaymentStatus(PaymentStatus status);

    long countByCustomerIdAndPaymentStatus(Long customerId, PaymentStatus status);

    boolean existsByCustomerId(Long customerId);

    boolean existsByCustomerIdAndPaymentStatus(Long customerId, PaymentStatus status);
    boolean existsByStationId(Long stationId);
    boolean existsBySessionId(Long sessionId);
    boolean existsByInvoiceNumber(String invoiceNumber);

    void deleteByCustomerId(Long customerId);
}
