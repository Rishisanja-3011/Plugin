package com.plugin.repository;

import com.plugin.entity.Booking;
import com.plugin.enums.BookingStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RequiredArgsConstructor
public class BookingRepositoryImpl implements BookingRepositoryCustom {

    private static final List<BookingStatus> ACTIVE_STATUSES = List.of(BookingStatus.CONFIRMED, BookingStatus.MODIFIED);
    private static final List<BookingStatus> BUSY_STATUSES = List.of(BookingStatus.CONFIRMED, BookingStatus.COMPLETED);

    private final MongoTemplate mongoTemplate;

    @Override
    public boolean existsActiveByCustomerId(Long customerId, LocalDateTime now) {
        Query query = Query.query(new Criteria().andOperator(
                relationIdCriteria("customerId", "customer.id", customerId),
                Criteria.where("status").in(ACTIVE_STATUSES),
                Criteria.where("endTime").gt(now)
        ));
        return mongoTemplate.exists(query, Booking.class);
    }

    @Override
    public List<Booking> findOverlappingBookings(Long pointId, LocalDateTime startTime, LocalDateTime endTime) {
        Query query = overlappingQuery(pointId, startTime, endTime);
        return mongoTemplate.find(query, Booking.class);
    }

    @Override
    public List<Booking> findOverlappingBookingsExcluding(Long pointId,
                                                          LocalDateTime startTime,
                                                          LocalDateTime endTime,
                                                          Long excludeId) {
        Query query = overlappingQuery(pointId, startTime, endTime);
        query.addCriteria(Criteria.where("id").ne(excludeId));
        return mongoTemplate.find(query, Booking.class);
    }

    @Override
    public List<Booking> findBookingsForPointOnDay(Long pointId, LocalDateTime dayStart, LocalDateTime dayEnd) {
        Query query = Query.query(new Criteria().andOperator(
                relationIdCriteria("chargingPointId", "chargingPoint.id", pointId),
                Criteria.where("status").in(ACTIVE_STATUSES),
                Criteria.where("startTime").gte(dayStart).lt(dayEnd)
        ))
                .with(Sort.by(Sort.Direction.ASC, "startTime"));
        return mongoTemplate.find(query, Booking.class);
    }

    @Override
    public Page<Booking> findByStationId(Long stationId, Pageable pageable) {
        Criteria criteria = relationIdCriteria("stationId", "station.id", stationId);
        long total = mongoTemplate.count(Query.query(criteria), Booking.class);
        Query query = Query.query(criteria).with(Sort.by(Sort.Direction.DESC, "createdAt")).with(pageable);
        List<Booking> content = mongoTemplate.find(query, Booking.class);
        return new PageImpl<>(content, pageable, total);
    }

    @Override
    public long countDistinctCustomersByStationManagerId(Long managerId) {
        Query query = Query.query(Criteria.where("station.manager.id").is(managerId));
        return mongoTemplate.findDistinct(query, "customer.id", Booking.class, Long.class).size();
    }

    @Override
    public long countDistinctCustomersByStationIds(List<Long> stationIds) {
        if (stationIds == null || stationIds.isEmpty()) {
            return 0;
        }
        Query query = Query.query(stationIdsCriteria(stationIds));
        return mongoTemplate.find(query, Booking.class).stream()
                .map(booking -> booking.getCustomerId() != null
                        ? booking.getCustomerId()
                        : booking.getCustomer() != null ? booking.getCustomer().getId() : null)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .count();
    }

    @Override
    public Map<Long, CustomerBookingCounts> countBookingsByCustomerIds(List<Long> customerIds) {
        Map<Long, MutableCustomerBookingCounts> mutableCounts = new HashMap<>();
        if (customerIds == null || customerIds.isEmpty()) {
            return Map.of();
        }

        Query query = Query.query(new Criteria().orOperator(
                Criteria.where("customerId").in(customerIds),
                Criteria.where("customer.id").in(customerIds)
        ));
        for (Booking booking : mongoTemplate.find(query, Booking.class)) {
            Long customerId = booking.getCustomerId() != null
                    ? booking.getCustomerId()
                    : booking.getCustomer() != null ? booking.getCustomer().getId() : null;
            if (customerId == null) {
                continue;
            }
            mutableCounts.computeIfAbsent(customerId, ignored -> new MutableCustomerBookingCounts())
                    .add(booking.getStatus());
        }

        Map<Long, CustomerBookingCounts> counts = new HashMap<>();
        for (Long customerId : customerIds) {
            MutableCustomerBookingCounts mutable = mutableCounts.getOrDefault(customerId, new MutableCustomerBookingCounts());
            counts.put(customerId, mutable.toImmutable());
        }
        return counts;
    }

    @Override
    public long countBookingsInRange(LocalDateTime start, LocalDateTime end) {
        Query query = Query.query(Criteria.where("startTime").gte(start).lt(end));
        return mongoTemplate.count(query, Booking.class);
    }

    @Override
    public List<Object[]> findBusiestHours() {
        Query query = Query.query(Criteria.where("status").in(BUSY_STATUSES));
        return busiestHours(mongoTemplate.find(query, Booking.class));
    }

    @Override
    public List<Object[]> findBusiestHoursByManagerId(Long managerId) {
        Query query = Query.query(Criteria.where("station.manager.id").is(managerId)
                .and("status").in(BUSY_STATUSES));
        return busiestHours(mongoTemplate.find(query, Booking.class));
    }

    @Override
    public List<Object[]> findBusiestHoursByStationIds(List<Long> stationIds) {
        if (stationIds == null || stationIds.isEmpty()) {
            return List.of();
        }
        Query query = Query.query(new Criteria().andOperator(
                stationIdsCriteria(stationIds),
                Criteria.where("status").in(BUSY_STATUSES)
        ));
        return busiestHours(mongoTemplate.find(query, Booking.class));
    }

    private Query overlappingQuery(Long pointId, LocalDateTime startTime, LocalDateTime endTime) {
        return Query.query(new Criteria().andOperator(
                relationIdCriteria("chargingPointId", "chargingPoint.id", pointId),
                Criteria.where("status").in(ACTIVE_STATUSES),
                Criteria.where("startTime").lt(endTime),
                Criteria.where("endTime").gt(startTime)
        ));
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

    private List<Object[]> busiestHours(List<Booking> bookings) {
        Map<Integer, Long> countsByHour = bookings.stream()
                .filter(booking -> booking.getStartTime() != null)
                .collect(Collectors.groupingBy(booking -> booking.getStartTime().getHour(), Collectors.counting()));

        return countsByHour.entrySet().stream()
                .sorted(Map.Entry.<Integer, Long>comparingByValue(Comparator.reverseOrder()))
                .map(entry -> new Object[] {entry.getKey(), entry.getValue()})
                .toList();
    }

    private static class MutableCustomerBookingCounts {
        private long total;
        private long completed;
        private long cancelled;
        private long active;

        private void add(BookingStatus status) {
            total++;
            if (status == BookingStatus.COMPLETED) {
                completed++;
            } else if (status == BookingStatus.CANCELLED) {
                cancelled++;
            } else if (status == BookingStatus.CONFIRMED || status == BookingStatus.MODIFIED) {
                active++;
            }
        }

        private CustomerBookingCounts toImmutable() {
            return new CustomerBookingCounts(total, completed, cancelled, active);
        }
    }
}
