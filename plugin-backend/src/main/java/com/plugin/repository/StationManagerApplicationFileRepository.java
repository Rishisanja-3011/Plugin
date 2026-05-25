package com.plugin.repository;

import com.plugin.entity.StationManagerApplicationFile;
import com.plugin.enums.StationManagerBusinessDocumentType;
import com.plugin.enums.StationManagerFileSlot;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface StationManagerApplicationFileRepository extends MongoRepository<StationManagerApplicationFile, String> {
    Optional<StationManagerApplicationFile> findByApplicationIdAndSlotType(Long applicationId, StationManagerFileSlot slotType);

    Optional<StationManagerApplicationFile> findByApplicationIdAndSlotTypeAndBusinessDocumentType(
            Long applicationId,
            StationManagerFileSlot slotType,
            StationManagerBusinessDocumentType businessDocumentType
    );

    List<StationManagerApplicationFile> findAllByApplicationIdAndSlotType(Long applicationId, StationManagerFileSlot slotType);

    void deleteByApplicationIdAndSlotTypeAndBusinessDocumentType(
            Long applicationId,
            StationManagerFileSlot slotType,
            StationManagerBusinessDocumentType businessDocumentType
    );
}
