package com.plugin.repository;

import com.plugin.entity.Booking;
import com.plugin.enums.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends MongoRepository<Booking, String>, BookingRepositoryCustom {

    Optional<Booking> findById(Long id);
    List<Booking> findByIdIn(List<Long> ids);
    Optional<Booking> findByReferenceId(String referenceId);

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

    long countByStatus(BookingStatus status);
}
