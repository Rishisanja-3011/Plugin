package com.plugin.service;

import com.plugin.dto.response.AuditLogResponse;
import com.plugin.entity.AuditLog;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public void log(String action, String entityType, Long entityId, String performedBy, String details) {
        AuditLog entry = AuditLog.builder()
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .performedBy(performedBy)
                .details(details)
                .build();
        auditLogRepository.save(entry);
    }

    public Page<AuditLogResponse> getAll(Pageable pageable) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::toResponse);
    }

    public Page<AuditLogResponse> getByEntityType(String entityType, Pageable pageable) {
        String normalized = entityType == null ? "" : entityType.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty() || normalized.length() > 64) {
            throw new BadRequestException("Audit entity type must contain between 1 and 64 characters");
        }
        return auditLogRepository.findByEntityTypeOrderByCreatedAtDesc(normalized, pageable).map(this::toResponse);
    }

    private AuditLogResponse toResponse(AuditLog log) {
        return AuditLogResponse.builder()
                .id(log.getId())
                .action(log.getAction())
                .entityType(log.getEntityType())
                .entityId(log.getEntityId())
                .performedBy(log.getPerformedBy())
                .details(log.getDetails())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
