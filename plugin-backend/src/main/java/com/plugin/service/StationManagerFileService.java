package com.plugin.service;

import com.plugin.entity.StationManagerApplication;
import com.plugin.entity.StationManagerApplicationFile;
import com.plugin.enums.StationManagerBusinessDocumentType;
import com.plugin.enums.StationManagerFileSlot;
import com.plugin.exception.BadRequestException;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.StationManagerApplicationFileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class StationManagerFileService {

    public record DownloadedFile(byte[] data, String fileName, String contentType) {}

    private final StationManagerApplicationFileRepository fileRepository;

    @Transactional
    public String upsertStandardFile(StationManagerApplication application,
                                     StationManagerFileSlot slotType,
                                     MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        StationManagerApplicationFile entity = fileRepository.findByApplicationIdAndSlotType(application.getId(), slotType)
                .orElse(StationManagerApplicationFile.builder()
                        .application(application)
                        .slotType(slotType)
                        .build());
        applyFile(entity, file);
        return fileRepository.save(entity).getOriginalFileName();
    }

    @Transactional
    public String upsertBusinessDocumentFile(StationManagerApplication application,
                                             StationManagerBusinessDocumentType documentType,
                                             MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        StationManagerApplicationFile entity = fileRepository
                .findByApplicationIdAndSlotTypeAndBusinessDocumentType(application.getId(), StationManagerFileSlot.BUSINESS_DOCUMENT, documentType)
                .orElse(StationManagerApplicationFile.builder()
                        .application(application)
                        .slotType(StationManagerFileSlot.BUSINESS_DOCUMENT)
                        .businessDocumentType(documentType)
                        .build());
        applyFile(entity, file);
        return fileRepository.save(entity).getOriginalFileName();
    }

    @Transactional(readOnly = true)
    public boolean hasStandardFile(Long applicationId, StationManagerFileSlot slotType) {
        return fileRepository.findByApplicationIdAndSlotType(applicationId, slotType).isPresent();
    }

    @Transactional(readOnly = true)
    public boolean hasBusinessDocumentFile(Long applicationId, StationManagerBusinessDocumentType documentType) {
        return fileRepository.findByApplicationIdAndSlotTypeAndBusinessDocumentType(
                applicationId,
                StationManagerFileSlot.BUSINESS_DOCUMENT,
                documentType
        ).isPresent();
    }

    @Transactional
    public void deleteMissingBusinessDocumentFiles(Long applicationId, Set<StationManagerBusinessDocumentType> activeTypes) {
        List<StationManagerApplicationFile> existing = fileRepository.findAllByApplicationIdAndSlotType(applicationId, StationManagerFileSlot.BUSINESS_DOCUMENT);
        for (StationManagerApplicationFile file : existing) {
            if (file.getBusinessDocumentType() == null || !activeTypes.contains(file.getBusinessDocumentType())) {
                fileRepository.delete(file);
            }
        }
    }

    @Transactional(readOnly = true)
    public DownloadedFile getStandardFile(Long applicationId, StationManagerFileSlot slotType) {
        StationManagerApplicationFile file = fileRepository.findByApplicationIdAndSlotType(applicationId, slotType)
                .orElseThrow(() -> new ResourceNotFoundException("Application file not found"));
        return new DownloadedFile(file.getFileData(), file.getOriginalFileName(), file.getContentType());
    }

    @Transactional(readOnly = true)
    public DownloadedFile getBusinessDocumentFile(Long applicationId, StationManagerBusinessDocumentType documentType) {
        StationManagerApplicationFile file = fileRepository
                .findByApplicationIdAndSlotTypeAndBusinessDocumentType(applicationId, StationManagerFileSlot.BUSINESS_DOCUMENT, documentType)
                .orElseThrow(() -> new ResourceNotFoundException("Business document file not found"));
        return new DownloadedFile(file.getFileData(), file.getOriginalFileName(), file.getContentType());
    }

    private void applyFile(StationManagerApplicationFile entity, MultipartFile file) {
        try {
            entity.setOriginalFileName(file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()
                    ? "document"
                    : file.getOriginalFilename().trim());
            entity.setContentType(file.getContentType());
            entity.setFileSize(file.getSize());
            entity.setFileData(file.getBytes());
        } catch (IOException ex) {
            throw new BadRequestException("Failed to store uploaded file");
        }
    }
}
