package com.plugin.repository;

import com.plugin.entity.Station;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.regex.Pattern;

@RequiredArgsConstructor
public class StationRepositoryImpl implements StationRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    @Override
    public Page<Station> searchStations(String query, Pageable pageable) {
        Pattern pattern = Pattern.compile(Pattern.quote(query == null ? "" : query), Pattern.CASE_INSENSITIVE);
        Criteria criteria = new Criteria().orOperator(
                Criteria.where("city").regex(pattern),
                Criteria.where("name").regex(pattern),
                Criteria.where("pincode").regex(pattern),
                Criteria.where("address").regex(pattern)
        );

        Query countQuery = Query.query(criteria);
        long total = mongoTemplate.count(countQuery, Station.class);

        Query pageQuery = Query.query(criteria).with(pageable);
        List<Station> content = mongoTemplate.find(pageQuery, Station.class);
        return new PageImpl<>(content, pageable, total);
    }
}
