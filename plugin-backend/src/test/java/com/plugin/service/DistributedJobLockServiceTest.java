package com.plugin.service;

import com.plugin.entity.ScheduledJobLease;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DistributedJobLockServiceTest {

    @Mock private MongoTemplate mongoTemplate;
    @InjectMocks private DistributedJobLockService service;

    @Test
    void acquiresLeaseWithOneAtomicDatabaseOperation() {
        when(mongoTemplate.findAndModify(
                any(Query.class),
                any(Update.class),
                any(FindAndModifyOptions.class),
                eq(ScheduledJobLease.class)))
                .thenReturn(ScheduledJobLease.builder().id("booking-expiry").build());

        assertThat(service.tryAcquire("booking-expiry", Duration.ofMinutes(1))).isTrue();
    }

    @Test
    void duplicateUpsertMeansAnotherNodeOwnsTheLease() {
        when(mongoTemplate.findAndModify(
                any(Query.class),
                any(Update.class),
                any(FindAndModifyOptions.class),
                eq(ScheduledJobLease.class)))
                .thenThrow(new DuplicateKeyException("lease held"));

        assertThat(service.tryAcquire("booking-expiry", Duration.ofMinutes(1))).isFalse();
    }
}
