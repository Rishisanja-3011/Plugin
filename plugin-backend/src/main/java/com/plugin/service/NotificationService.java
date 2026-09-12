package com.plugin.service;

import com.plugin.dto.response.NotificationResponse;
import com.plugin.entity.Notification;
import com.plugin.entity.User;
import com.plugin.repository.NotificationRepository;
import com.plugin.repository.UserRepository;
import com.plugin.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public void send(Long userId, String title, String message) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Notification notif = Notification.builder()
                .user(user)
                .title(title)
                .message(message)
                .isRead(false)
                .build();
        notificationRepository.save(notif);
    }

    public void sendIfNew(Long userId, String title, String message, java.time.Duration minimumInterval) {
        java.time.LocalDateTime cutoff = java.time.LocalDateTime.now().minus(minimumInterval);
        if (!notificationRepository.existsByUserIdAndTitleAndCreatedAtAfter(userId, title, cutoff)) {
            send(userId, title, message);
        }
    }

    public Page<NotificationResponse> getMyNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toResponse);
    }

    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    public void markAsRead(Long notificationId, Long userId) {
        Notification notif = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        notif.setIsRead(true);
        notificationRepository.save(notif);
    }

    public void markAllAsRead(Long userId) {
        Page<Notification> notifications = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId, Pageable.unpaged());
        notifications.forEach(n -> {
            n.setIsRead(true);
            notificationRepository.save(n);
        });
    }

    private NotificationResponse toResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .title(n.getTitle())
                .message(n.getMessage())
                .isRead(n.getIsRead())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
