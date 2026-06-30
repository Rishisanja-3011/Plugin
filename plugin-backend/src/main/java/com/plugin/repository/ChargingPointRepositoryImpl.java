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
    public ChargingPoint lockAvailablePointForStation(Long stationId, PointType pointType) {
        Criteria criteria = Criteria.where("stationId").is(stationId)
                .and("status").is(PointStatus.AVAILABLE);
        if (pointType != null) {
            criteria = criteria.and("pointType").is(pointType);
        }

        Query query = Query.query(criteria)
                .with(Sort.by(Sort.Direction.ASC, "id"))
                .limit(1);
        Update update = new Update()
                .set("status", PointStatus.RESERVED)
                .set("updatedAt", LocalDateTime.now());
        return mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                ChargingPoint.class
        );
    }
}
