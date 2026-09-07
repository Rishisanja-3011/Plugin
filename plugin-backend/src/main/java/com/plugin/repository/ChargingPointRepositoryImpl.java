package com.plugin.repository;

import com.plugin.entity.ChargingPoint;
import com.plugin.enums.PointStatus;
import com.plugin.enums.PointType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.LocalDateTime;
import java.util.List;

@RequiredArgsConstructor
public class ChargingPointRepositoryImpl implements ChargingPointRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    @Override
    public LocalDateTime findLatestUpdatedAtForActiveStations() {
        Query query = Query.query(Criteria.where("station.active").is(true))
                .with(Sort.by(Sort.Direction.DESC, "updatedAt"))
                .limit(1);
        ChargingPoint point = mongoTemplate.findOne(query, ChargingPoint.class);
        return point == null ? null : point.getUpdatedAt();
    }

    @Override
    public LocalDateTime findLatestUpdatedAtForStationIds(List<Long> stationIds) {
        if (stationIds == null || stationIds.isEmpty()) {
            return null;
        }
        Query query = Query.query(Criteria.where("stationId").in(stationIds))
                .with(Sort.by(Sort.Direction.DESC, "updatedAt"))
                .limit(1);
        ChargingPoint point = mongoTemplate.findOne(query, ChargingPoint.class);
        return point == null ? null : point.getUpdatedAt();
    }

    @Override
    public ChargingPoint reserveAvailablePoint(Long pointId, Long bookingId) {
        Query query = Query.query(new Criteria().andOperator(
                Criteria.where("id").is(pointId),
                Criteria.where("status").is(PointStatus.AVAILABLE)
        ));
        Update update = new Update()
                .set("status", PointStatus.RESERVED)
                .set("reservedByBookingId", bookingId)
                .unset("activeSessionId")
                .inc("version", 1L)
                .set("updatedAt", LocalDateTime.now());
        return mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                ChargingPoint.class
        );
    }

    @Override
    public ChargingPoint claimPointForSession(Long pointId, Long bookingId, Long sessionId) {
        Criteria available = Criteria.where("status").is(PointStatus.AVAILABLE);
        Criteria ownedReservation = new Criteria().andOperator(
                Criteria.where("status").is(PointStatus.RESERVED),
                Criteria.where("reservedByBookingId").is(bookingId)
        );
        Query query = Query.query(new Criteria().andOperator(
                Criteria.where("id").is(pointId),
                new Criteria().orOperator(available, ownedReservation)
        ));
        Update update = new Update()
                .set("status", PointStatus.CHARGING)
                .set("activeSessionId", sessionId)
                .unset("reservedByBookingId")
                .inc("version", 1L)
                .set("updatedAt", LocalDateTime.now());
        return mongoTemplate.findAndModify(query, update,
                FindAndModifyOptions.options().returnNew(true), ChargingPoint.class);
    }

    @Override
    public boolean releaseReservationForBooking(Long pointId, Long bookingId) {
        Query query = Query.query(new Criteria().andOperator(
                Criteria.where("id").is(pointId),
                Criteria.where("status").is(PointStatus.RESERVED),
                Criteria.where("reservedByBookingId").is(bookingId)
        ));
        Update update = new Update()
                .set("status", PointStatus.AVAILABLE)
                .unset("reservedByBookingId")
                .inc("version", 1L)
                .set("updatedAt", LocalDateTime.now());
        return mongoTemplate.updateFirst(query, update, ChargingPoint.class).getModifiedCount() == 1;
    }

    @Override
    public boolean releasePointForSession(Long pointId, Long sessionId) {
        Query query = Query.query(new Criteria().andOperator(
                Criteria.where("id").is(pointId),
                Criteria.where("status").is(PointStatus.CHARGING),
                Criteria.where("activeSessionId").is(sessionId)
        ));
        Update update = new Update()
                .set("status", PointStatus.AVAILABLE)
                .unset("activeSessionId")
                .inc("version", 1L)
                .set("updatedAt", LocalDateTime.now());
        return mongoTemplate.updateFirst(query, update, ChargingPoint.class).getModifiedCount() == 1;
    }

    @Override
    public void touchSchedule(Long pointId) {
        Query query = Query.query(Criteria.where("id").is(pointId));
        Update update = new Update()
                .inc("scheduleRevision", 1L)
                .inc("version", 1L)
                .set("updatedAt", LocalDateTime.now());
        mongoTemplate.updateFirst(query, update, ChargingPoint.class);
    }
}
