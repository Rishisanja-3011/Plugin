package com.plugin.service;

import com.plugin.entity.ScheduledJobLease;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DistributedJobLockService {

    private final MongoTemplate mongoTemplate;
    private final String ownerId = UUID.randomUUID().toString();

    public boolean tryAcquire(String jobName, Duration leaseDuration) {
        if (jobName == null || jobName.isBlank() || leaseDuration == null
                || leaseDuration.isZero() || leaseDuration.isNegative()) {
            throw new IllegalArgumentException("Scheduled job lease is invalid");
        }

        Instant now = Instant.now();
        Criteria available = new Criteria().orOperator(
                Criteria.where("lockedUntil").lte(now),
                Criteria.where("lockedUntil").exists(false)
        );
        Query query = Query.query(new Criteria().andOperator(
                Criteria.where("_id").is(jobName),
                available
        ));
        Update update = new Update()
                .set("ownerId", ownerId)
                .set("lockedUntil", now.plus(leaseDuration))
                .set("updatedAt", now);
        try {
            return mongoTemplate.findAndModify(
                    query,
                    update,
                    FindAndModifyOptions.options().upsert(true).returnNew(true),
                    ScheduledJobLease.class
            ) != null;
        } catch (DuplicateKeyException ex) {
            return false;
        } catch (DataAccessException ex) {
            log.error("Scheduled job lease is unavailable; job={}, type={}",
                    jobName, ex.getClass().getName());
            return false;
        }
    }

    public void release(String jobName) {
        Instant now = Instant.now();
        try {
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").is(jobName).and("ownerId").is(ownerId)),
                    new Update().unset("ownerId").set("lockedUntil", now).set("updatedAt", now),
                    ScheduledJobLease.class
            );
        } catch (DataAccessException ex) {
            log.error("Failed to release scheduled job lease; job={}, type={}",
                    jobName, ex.getClass().getName());
        }
    }
}
