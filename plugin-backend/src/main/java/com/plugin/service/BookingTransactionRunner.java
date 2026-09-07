package com.plugin.service;

import com.mongodb.MongoException;
import com.plugin.entity.User;
import com.plugin.exception.ConflictException;
import com.plugin.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class BookingTransactionRunner {
    private final PlatformTransactionManager transactionManager;
    private final MongoTemplate mongoTemplate;

    public <T> T execute(Supplier<T> operation) {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        for (int attempt = 0; attempt < 8; attempt++) {
            try {
                return transaction.execute(status -> operation.get());
            } catch (RuntimeException ex) {
                if (!isRetryable(ex)) throw ex;
                if (attempt == 7) break;
                try {
                    Thread.sleep(ThreadLocalRandom.current().nextLong(20, 60) * (attempt + 1));
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new ConflictException("Booking was interrupted. Refresh availability and try again.");
                }
            }
        }
        throw new ConflictException("Availability is changing. Please retry your booking.");
    }

    public void claimCustomer(Long customerId) {
        // Serialize the check-and-create invariant on one document across all API instances.
        long matched = mongoTemplate.updateFirst(Query.query(Criteria.where("id").is(customerId)),
                new Update().inc("bookingRevision", 1L).inc("version", 1L), User.class).getMatchedCount();
        if (matched != 1) throw new ResourceNotFoundException("Customer not found");
    }

    private boolean isRetryable(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof OptimisticLockingFailureException) return true;
            if (cause instanceof MongoException mongo &&
                    (mongo.hasErrorLabel("TransientTransactionError") || mongo.getCode() == 112)) return true;
        }
        // An unknown commit outcome must not replay a mutation with a new identity.
        return false;
    }
}
