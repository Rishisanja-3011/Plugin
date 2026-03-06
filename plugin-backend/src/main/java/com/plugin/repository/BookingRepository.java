package com.plugin.repository;

import com.plugin.entity.Booking;
import com.plugin.enums.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByReferenceId(String referenceId);

    Page<Booking> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);

    List<Booking> findByCustomerIdAndStatusIn(Long customerId, List<BookingStatus> statuses);

    boolean existsByCustomerIdAndStatusIn(Long customerId, List<BookingStatus> statuses);

    @Query("SELECT CASE WHEN COUNT(b) > 0 THEN true ELSE false END " +
           "FROM Booking b WHERE b.customer.id = :customerId " +
           "AND b.status IN ('CONFIRMED', 'MODIFIED') " +
           "AND b.endTime > :now")
    boolean existsActiveByCustomerId(@Param("customerId") Long customerId,
                                     @Param("now") LocalDateTime now);

    void deleteByCustomerId(Long customerId);

    @Query("SELECT b FROM Booking b WHERE b.chargingPoint.id = :pointId " +
           "AND b.status IN ('CONFIRMED', 'MODIFIED') " +
           "AND b.startTime < :endTime AND b.endTime > :startTime")
    List<Booking> findOverlappingBookings(
        @Param("pointId") Long pointId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    @Query("SELECT b FROM Booking b WHERE b.chargingPoint.id = :pointId " +
           "AND b.status IN ('CONFIRMED', 'MODIFIED') " +
           "AND b.startTime < :endTime AND b.endTime > :startTime " +
           "AND b.id <> :excludeId")
    List<Booking> findOverlappingBookingsExcluding(
        @Param("pointId") Long pointId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime,
        @Param("excludeId") Long excludeId);

    @Query("SELECT b FROM Booking b WHERE b.chargingPoint.id = :pointId " +
           "AND b.status IN ('CONFIRMED', 'MODIFIED') " +
           "AND b.startTime >= :dayStart AND b.startTime < :dayEnd " +
           "ORDER BY b.startTime")
    List<Booking> findBookingsForPointOnDay(
        @Param("pointId") Long pointId,
        @Param("dayStart") LocalDateTime dayStart,
        @Param("dayEnd") LocalDateTime dayEnd);

    Page<Booking> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Booking> findByStatusOrderByCreatedAtDesc(BookingStatus status, Pageable pageable);
    long countByCustomerId(Long customerId);
    long countByCustomerIdAndStatus(Long customerId, BookingStatus status);

    boolean existsByCustomerId(Long customerId);

    @Query("SELECT b FROM Booking b WHERE b.station.id = :stationId ORDER BY b.createdAt DESC")
    Page<Booking> findByStationId(@Param("stationId") Long stationId, Pageable pageable);

    long countByStatus(BookingStatus status);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.startTime >= :start AND b.startTime < :end")
    long countBookingsInRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT HOUR(b.startTime) as hr, COUNT(b) as cnt FROM Booking b " +
           "WHERE b.status IN ('CONFIRMED', 'COMPLETED') GROUP BY HOUR(b.startTime) ORDER BY cnt DESC")
    List<Object[]> findBusiestHours();
}
