package com.plugin.repository;

import com.plugin.entity.ChargingSession;
import com.plugin.enums.SessionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@RequiredArgsConstructor
public class ChargingSessionRepositoryImpl implements ChargingSessionRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    @Override
    public boolean existsByCustomerIdAndStatusAndVehicleId(Long customerId, SessionStatus status, Long vehicleId) {
        Query query = Query.query(new Criteria().andOperator(
                relationIdCriteria("customerId", "customer.id", customerId),
                Criteria.where("status").is(status),
                relationIdCriteria("booking.vehicleId", "booking.vehicle.id", vehicleId)
        ));
        return mongoTemplate.exists(query, ChargingSession.class);
    }

    @Override
    public BigDecimal getTotalEnergyDelivered() {
        return sumCompletedEnergy(null, null, null, null);
    }

    @Override
    public BigDecimal getTotalEnergyDeliveredByManagerId(Long managerId) {
        return sumCompletedEnergy(null, null, "chargingPoint.station.manager.id", managerId);
    }

    @Override
    public BigDecimal getTotalEnergyDeliveredByChargingPointIds(List<Long> chargingPointIds) {
        if (chargingPointIds == null || chargingPointIds.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return sumCompletedEnergy(null, null, "chargingPointId", chargingPointIds);
    }

    @Override
    public BigDecimal getEnergyDeliveredInRange(LocalDateTime start, LocalDateTime end) {
        return sumCompletedEnergy(start, end, null, null);
    }

    private BigDecimal sumCompletedEnergy(LocalDateTime start, LocalDateTime end, String field, Object value) {
        List<Criteria> criteria = new ArrayList<>();
        criteria.add(Criteria.where("status").is(SessionStatus.COMPLETED));
        if (start != null || end != null) {
            Criteria range = Criteria.where("endTime");
            if (start != null) {
                range = range.gte(start);
            }
            if (end != null) {
                range = range.lt(end);
            }
            criteria.add(range);
        }
        if (field != null && value != null) {
            if (value instanceof List<?> values) {
                criteria.add(Criteria.where(field).in(values));
            } else {
                criteria.add(Criteria.where(field).is(value));
            }
        }

        Criteria combined = new Criteria().andOperator(criteria.toArray(Criteria[]::new));
        return mongoTemplate.find(Query.query(combined), ChargingSession.class).stream()
                .map(ChargingSession::getEnergyDeliveredKwh)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Criteria relationIdCriteria(String directProperty, String nestedProperty, Long value) {
        return new Criteria().orOperator(
                Criteria.where(directProperty).is(value),
                Criteria.where(nestedProperty).is(value)
        );
    }
}
