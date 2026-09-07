package com.plugin.service;

import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import com.mongodb.client.model.ReturnDocument;
import com.mongodb.client.model.Updates;
import com.mongodb.client.model.UpdateOptions;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MongoSequenceService {

    private final MongoDatabaseFactory databaseFactory;

    public long nextId(String sequenceName) {
        MongoDatabase database = databaseFactory.getMongoDatabase();
        MongoCollection<Document> sequences = database.getCollection("database_sequences");
        ensureSequenceAtLeastCurrentMax(database, sequences, sequenceName);
        Document sequence = sequences.findOneAndUpdate(
                Filters.eq("_id", sequenceName),
                Updates.inc("seq", 1L),
                new FindOneAndUpdateOptions()
                        .upsert(true)
                        .returnDocument(ReturnDocument.AFTER)
        );
        Number value = sequence == null ? null : sequence.get("seq", Number.class);
        return value == null ? 1L : value.longValue();
    }

    private void ensureSequenceAtLeastCurrentMax(MongoDatabase database,
                                                 MongoCollection<Document> sequences,
                                                 String sequenceName) {
        long currentMax = currentMaxId(database, sequenceName);
        try {
            // Atomic max never rewinds a counter that another request has advanced.
            sequences.updateOne(Filters.eq("_id", sequenceName), Updates.max("seq", currentMax),
                    new UpdateOptions().upsert(true));
        } catch (MongoWriteException ex) {
            if (ex.getError().getCode() != 11000) throw ex;
            // Another first request created the same sequence concurrently.
            sequences.updateOne(Filters.eq("_id", sequenceName), Updates.max("seq", currentMax));
        }
    }

    private long currentMaxId(MongoDatabase database, String collectionName) {
        Document latest = database.getCollection(collectionName)
                .find(Filters.exists("id", true))
                .sort(new Document("id", -1))
                .projection(new Document("id", 1))
                .first();
        Number value = latest == null ? null : latest.get("id", Number.class);
        return value == null ? 0L : value.longValue();
    }
}
