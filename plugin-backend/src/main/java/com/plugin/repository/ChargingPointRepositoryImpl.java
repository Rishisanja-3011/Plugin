package com.plugin.repository;

import com.plugin.entity.ChargingPoint;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

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
}
