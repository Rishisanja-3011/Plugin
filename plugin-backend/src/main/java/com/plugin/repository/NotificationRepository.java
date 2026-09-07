package com.plugin.repository;

import com.plugin.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

public interface NotificationRepository extends MongoRepository<Notification, String> {
    java.util.Optional<Notification> findById(Long id);
    java.util.Optional<Notification> findByIdAndUserId(Long id, Long userId);
    Page<Notification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    @Query(value = "{ 'userId': ?0, 'isRead': { $in: [false, 0, null] } }", count = true)
    long countByUserIdAndIsReadFalse(Long userId);
    void deleteByUserId(Long userId);
}
