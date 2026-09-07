package com.plugin.repository;

import com.plugin.entity.ChargingSession;
import com.plugin.enums.SessionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ChargingSessionRepository extends MongoRepository<ChargingSession, String>, ChargingSessionRepositoryCustom {

    Optional<ChargingSession> findById(Long id);
    Page<ChargingSession> findByCustomerIdOrderByStartTimeDesc(Long customerId, Pageable pageable);

    List<ChargingSession> findByCustomerIdAndStatus(Long customerId, SessionStatus status);

    Optional<ChargingSession> findByBookingId(Long bookingId);

    Page<ChargingSession> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<ChargingSession> findByChargingPointStationManagerIdOrderByCreatedAtDesc(Long managerId, Pageable pageable);

    List<ChargingSession> findByStatus(SessionStatus status);
    long countByChargingPointIdIn(List<Long> chargingPointIds);
    long countByChargingPointIdInAndStatus(List<Long> chargingPointIds, SessionStatus status);

    boolean existsByCustomerId(Long customerId);

    boolean existsByCustomerIdAndStatus(Long customerId, SessionStatus status);
    boolean existsByChargingPointId(Long chargingPointId);
    boolean existsByChargingPointIdAndStatus(Long chargingPointId, SessionStatus status);

    void deleteByCustomerId(Long customerId);

    long countByStatus(SessionStatus status);
    long countByChargingPointStationManagerId(Long managerId);
    long countByChargingPointStationManagerIdAndStatus(Long managerId, SessionStatus status);
}
