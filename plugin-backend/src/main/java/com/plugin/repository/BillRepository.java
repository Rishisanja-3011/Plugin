package com.plugin.repository;

import com.plugin.entity.Bill;
import com.plugin.enums.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BillRepository extends JpaRepository<Bill, Long> {

    Page<Bill> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);

    Page<Bill> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Optional<Bill> findByIdAndCustomerId(Long id, Long customerId);

    @Query("SELECT b FROM Bill b WHERE b.customer.id = :customerId " +
           "AND (:start IS NULL OR b.createdAt >= :start) " +
           "AND (:endExclusive IS NULL OR b.createdAt < :endExclusive) " +
           "ORDER BY b.createdAt DESC")
    List<Bill> findStatementBillsForCustomer(@Param("customerId") Long customerId,
                                             @Param("start") LocalDateTime start,
                                             @Param("endExclusive") LocalDateTime endExclusive);

    @Query("SELECT b FROM Bill b WHERE (:stationId IS NULL OR b.station.id = :stationId) " +
           "AND (:start IS NULL OR b.createdAt >= :start) AND (:end IS NULL OR b.createdAt < :end)")
    Page<Bill> findAllFiltered(@Param("stationId") Long stationId,
                               @Param("start") LocalDateTime start,
                               @Param("end") LocalDateTime end,
                               Pageable pageable);

    @Query("SELECT COALESCE(SUM(b.totalAmount), 0) FROM Bill b WHERE b.paymentStatus = 'PAID'")
    BigDecimal getTotalRevenue();

    @Query("SELECT COALESCE(SUM(b.totalAmount), 0) FROM Bill b " +
           "WHERE b.paymentStatus = 'PAID' AND b.station.manager.id = :managerId")
    BigDecimal getTotalRevenueByManagerId(@Param("managerId") Long managerId);

    @Query("SELECT COALESCE(SUM(b.totalAmount), 0) FROM Bill b WHERE b.paymentStatus = 'PAID' " +
           "AND b.createdAt >= :start AND b.createdAt < :end")
    BigDecimal getRevenueInRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(b.totalAmount), 0) FROM Bill b WHERE b.paymentStatus = 'PAID' " +
           "AND b.station.id = :stationId AND b.createdAt >= :start AND b.createdAt < :end")
    BigDecimal getRevenueByStationInRange(@Param("stationId") Long stationId,
                                           @Param("start") LocalDateTime start,
                                           @Param("end") LocalDateTime end);

    long countByPaymentStatus(PaymentStatus status);

    long countByCustomerIdAndPaymentStatus(Long customerId, PaymentStatus status);

    boolean existsByCustomerId(Long customerId);

    boolean existsByCustomerIdAndPaymentStatus(Long customerId, PaymentStatus status);

    void deleteByCustomerId(Long customerId);
}
