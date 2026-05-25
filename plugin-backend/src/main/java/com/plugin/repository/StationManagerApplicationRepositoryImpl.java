package com.plugin.repository;

import com.plugin.entity.StationManagerApplication;
import com.plugin.enums.StationManagerApplicationStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@RequiredArgsConstructor
public class StationManagerApplicationRepositoryImpl implements StationManagerApplicationRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    @Override
    public Page<StationManagerApplication> search(StationManagerApplicationStatus status,
                                                  String query,
                                                  boolean linkedStationOnly,
                                                  Pageable pageable) {
        List<Criteria> criteria = new ArrayList<>();
        if (status != null) {
            criteria.add(Criteria.where("status").is(status));
        }
        if (linkedStationOnly) {
            criteria.add(Criteria.where("approvedStation").ne(null));
        }
        if (query != null && !query.isBlank()) {
            Pattern pattern = Pattern.compile(Pattern.quote(query), Pattern.CASE_INSENSITIVE);
            criteria.add(new Criteria().orOperator(
                    Criteria.where("applicationReferenceId").regex(pattern),
                    Criteria.where("fullName").regex(pattern),
                    Criteria.where("email").regex(pattern),
                    Criteria.where("businessName").regex(pattern),
                    Criteria.where("stationName").regex(pattern)
            ));
        }

        Criteria combined = criteria.isEmpty()
                ? new Criteria()
                : new Criteria().andOperator(criteria.toArray(Criteria[]::new));

        Query countQuery = Query.query(combined);
        long total = mongoTemplate.count(countQuery, StationManagerApplication.class);

        Query pageQuery = Query.query(combined).with(pageable);
        List<StationManagerApplication> content = mongoTemplate.find(pageQuery, StationManagerApplication.class);
        return new PageImpl<>(content, pageable, total);
    }
}
