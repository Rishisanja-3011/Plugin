package com.plugin.repository;

import com.plugin.entity.Bill;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface BillRepositoryCustom {
    List<Bill> findStatementBillsForCustomer(Long customerId, LocalDateTime start, LocalDateTime endExclusive);

    Page<Bill> findAllFiltered(Long stationId, LocalDateTime start, LocalDateTime end, Pageable pageable);

    BigDecimal getTotalRevenue();

    BigDecimal getTotalRevenueByManagerId(Long managerId);

    BigDecimal getTotalRevenueByStationIds(List<Long> stationIds);

    BigDecimal getRevenueInRange(LocalDateTime start, LocalDateTime end);

    BigDecimal getRevenueByStationInRange(Long stationId, LocalDateTime start, LocalDateTime end);
}
