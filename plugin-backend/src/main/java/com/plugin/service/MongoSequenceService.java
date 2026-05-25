package com.plugin.service;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import com.mongodb.client.model.ReturnDocument;
import com.mongodb.client.model.Updates;
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
        Document existing = sequences.find(Filters.eq("_id", sequenceName)).first();
        Number existingValue = existing == null ? null : existing.get("seq", Number.class);
        if (existing == null) {
            sequences.insertOne(new Document("_id", sequenceName).append("seq", currentMax));
            return;
        }
        if (existingValue == null || existingValue.longValue() < currentMax) {
            sequences.updateOne(Filters.eq("_id", sequenceName), Updates.set("seq", currentMax));
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
