package com.plugin.repository;

import com.plugin.entity.ChargingSession;
import com.plugin.enums.SessionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ChargingSessionRepository extends JpaRepository<ChargingSession, Long> {

    Page<ChargingSession> findByCustomerIdOrderByStartTimeDesc(Long customerId, Pageable pageable);

    List<ChargingSession> findByCustomerIdAndStatus(Long customerId, SessionStatus status);

    Optional<ChargingSession> findByBookingId(Long bookingId);

    Page<ChargingSession> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<ChargingSession> findByChargingPointStationManagerIdOrderByCreatedAtDesc(Long managerId, Pageable pageable);

    List<ChargingSession> findByStatus(SessionStatus status);

    boolean existsByCustomerId(Long customerId);

    boolean existsByCustomerIdAndStatus(Long customerId, SessionStatus status);

    @Query("SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END " +
           "FROM ChargingSession s WHERE s.customer.id = :customerId " +
           "AND s.status = :status AND s.booking.vehicle.id = :vehicleId")
    boolean existsByCustomerIdAndStatusAndVehicleId(@Param("customerId") Long customerId,
                                                    @Param("status") SessionStatus status,
                                                    @Param("vehicleId") Long vehicleId);

    void deleteByCustomerId(Long customerId);

    @Query("SELECT COALESCE(SUM(s.energyDeliveredKwh), 0) FROM ChargingSession s WHERE s.status = 'COMPLETED'")
    BigDecimal getTotalEnergyDelivered();

    @Query("SELECT COALESCE(SUM(s.energyDeliveredKwh), 0) FROM ChargingSession s " +
           "WHERE s.status = 'COMPLETED' AND s.chargingPoint.station.manager.id = :managerId")
    BigDecimal getTotalEnergyDeliveredByManagerId(@Param("managerId") Long managerId);

    @Query("SELECT COALESCE(SUM(s.energyDeliveredKwh), 0) FROM ChargingSession s " +
           "WHERE s.status = 'COMPLETED' AND s.endTime >= :start AND s.endTime < :end")
    BigDecimal getEnergyDeliveredInRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    long countByStatus(SessionStatus status);
    long countByChargingPointStationManagerId(Long managerId);
    long countByChargingPointStationManagerIdAndStatus(Long managerId, SessionStatus status);
}
