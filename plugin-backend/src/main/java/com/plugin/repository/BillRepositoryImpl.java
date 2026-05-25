package com.plugin.repository;

import com.plugin.entity.Bill;
import com.plugin.enums.PaymentStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@RequiredArgsConstructor
public class BillRepositoryImpl implements BillRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    @Override
    public List<Bill> findStatementBillsForCustomer(Long customerId, LocalDateTime start, LocalDateTime endExclusive) {
        Query query = Query.query(andCriteria(
                relationIdCriteria("customerId", "customer.id", customerId),
                rangeCriteria("createdAt", start, endExclusive)
        )).with(Sort.by(Sort.Direction.DESC, "createdAt"));
        return mongoTemplate.find(query, Bill.class);
    }

    @Override
    public Page<Bill> findAllFiltered(Long stationId, LocalDateTime start, LocalDateTime end, Pageable pageable) {
        List<Criteria> criteria = new ArrayList<>();
        if (stationId != null) {
            criteria.add(relationIdCriteria("stationId", "station.id", stationId));
        }
        Criteria range = rangeCriteria("createdAt", start, end);
        if (range != null) {
            criteria.add(range);
        }

        Criteria combined = criteria.isEmpty()
                ? new Criteria()
                : new Criteria().andOperator(criteria.toArray(Criteria[]::new));
        long total = mongoTemplate.count(Query.query(combined), Bill.class);
        List<Bill> content = mongoTemplate.find(Query.query(combined).with(pageable), Bill.class);
        return new PageImpl<>(content, pageable, total);
    }

    @Override
    public BigDecimal getTotalRevenue() {
        return sumPaidRevenue(null, null, null);
    }

    @Override
    public BigDecimal getTotalRevenueByManagerId(Long managerId) {
        return sumPaidRevenue(null, null, Criteria.where("station.manager.id").is(managerId));
    }

    @Override
    public BigDecimal getTotalRevenueByStationIds(List<Long> stationIds) {
        if (stationIds == null || stationIds.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return sumPaidRevenue(null, null, stationIdsCriteria(stationIds));
    }

    @Override
    public BigDecimal getRevenueInRange(LocalDateTime start, LocalDateTime end) {
        return sumPaidRevenue(start, end, null);
    }

    @Override
    public BigDecimal getRevenueByStationInRange(Long stationId, LocalDateTime start, LocalDateTime end) {
        return sumPaidRevenue(start, end, relationIdCriteria("stationId", "station.id", stationId));
    }

    private BigDecimal sumPaidRevenue(LocalDateTime start, LocalDateTime end, Criteria extraCriteria) {
        List<Criteria> criteria = new ArrayList<>();
        criteria.add(Criteria.where("paymentStatus").is(PaymentStatus.PAID));
        Criteria range = rangeCriteria("createdAt", start, end);
        if (range != null) {
            criteria.add(range);
        }
        if (extraCriteria != null) {
            criteria.add(extraCriteria);
        }

        Criteria combined = andCriteria(criteria.toArray(Criteria[]::new));
        return mongoTemplate.find(Query.query(combined), Bill.class).stream()
                .map(Bill::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Criteria andCriteria(Criteria... criteria) {
        List<Criteria> present = new ArrayList<>();
        for (Criteria criterion : criteria) {
            if (criterion != null) {
                present.add(criterion);
            }
        }
        return present.isEmpty() ? new Criteria() : new Criteria().andOperator(present.toArray(Criteria[]::new));
    }

    private Criteria rangeCriteria(String field, LocalDateTime start, LocalDateTime end) {
        if (start == null && end == null) {
            return null;
        }
        Criteria criteria = Criteria.where(field);
        if (start != null) {
            criteria = criteria.gte(start);
        }
        if (end != null) {
            criteria = criteria.lt(end);
        }
        return criteria;
    }

    private Criteria relationIdCriteria(String directProperty, String nestedProperty, Long value) {
        return new Criteria().orOperator(
                Criteria.where(directProperty).is(value),
                Criteria.where(nestedProperty).is(value)
        );
    }

    private Criteria stationIdsCriteria(List<Long> stationIds) {
        return new Criteria().orOperator(
                Criteria.where("stationId").in(stationIds),
                Criteria.where("station.id").in(stationIds)
        );
    }
}
