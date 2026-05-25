package com.plugin.repository;

import com.plugin.entity.StationManagerApplicationDocument;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface StationManagerApplicationDocumentRepository extends MongoRepository<StationManagerApplicationDocument, String> {
}
