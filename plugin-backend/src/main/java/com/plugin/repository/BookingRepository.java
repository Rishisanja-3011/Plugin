package com.plugin.repository;

import com.plugin.entity.Booking;
import com.plugin.enums.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends MongoRepository<Booking, String>, BookingRepositoryCustom {

    Optional<Booking> findById(Long id);
    List<Booking> findByIdIn(List<Long> ids);
    Optional<Booking> findByReferenceId(String referenceId);
    Optional<Booking> findByCustomerIdAndRequestKey(Long customerId, String requestKey);

    Page<Booking> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);

    List<Booking> findByCustomerIdAndStatusIn(Long customerId, List<BookingStatus> statuses);

    boolean existsByCustomerIdAndStatusIn(Long customerId, List<BookingStatus> statuses);

    void deleteByCustomerId(Long customerId);

    Page<Booking> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Booking> findByStatusOrderByCreatedAtDesc(BookingStatus status, Pageable pageable);
    long countByStationManagerId(Long managerId);
    long countByStationManagerIdAndStatus(Long managerId, BookingStatus status);
    long countByStationIdIn(List<Long> stationIds);
    long countByStationIdInAndStatus(List<Long> stationIds, BookingStatus status);
    long countByCustomerId(Long customerId);
    long countByCustomerIdAndStatus(Long customerId, BookingStatus status);

    boolean existsByCustomerId(Long customerId);
    boolean existsByVehicleId(Long vehicleId);
    boolean existsByStationId(Long stationId);
    boolean existsByChargingPointId(Long chargingPointId);
    boolean existsByChargingPointIdAndStatusIn(Long chargingPointId, List<BookingStatus> statuses);

    long countByStatus(BookingStatus status);

    @Query("{ 'status': { $in: ?0 }, 'startTime': { $gte: ?1, $lte: ?2 }, '$or': [ { 'startNotificationSent': false }, { 'startNotificationSent': null }, { 'startNotificationSent': { $exists: false } } ] }")
    List<Booking> findDueStartNotifications(List<BookingStatus> statuses, LocalDateTime from, LocalDateTime to);

    @Query("{ 'status': { $in: ?0 }, '$or': [ { 'gracePeriodEndTime': { $lte: ?1 } }, { '$and': [ { '$or': [ { 'gracePeriodEndTime': null }, { 'gracePeriodEndTime': { $exists: false } } ] }, { 'endTime': { $lte: ?1 } } ] } ] }")
    List<Booking> findExpiredStartableBookings(List<BookingStatus> statuses, LocalDateTime now);
}
