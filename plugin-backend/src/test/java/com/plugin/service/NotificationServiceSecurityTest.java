package com.plugin.service;

import com.plugin.entity.Notification;
import com.plugin.exception.ResourceNotFoundException;
import com.plugin.repository.NotificationRepository;
import com.plugin.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceSecurityTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    void markAsReadDoesNotAllowCrossUserNotificationIds() {
        when(notificationRepository.findByIdAndUserId(42L, 7L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> notificationService.markAsRead(42L, 7L));

        verify(notificationRepository, never()).save(org.mockito.ArgumentMatchers.any(Notification.class));
    }

    @Test
    void markAsReadUpdatesOwnedNotification() {
        Notification notification = Notification.builder().id(42L).userId(7L).isRead(false).build();
        when(notificationRepository.findByIdAndUserId(42L, 7L)).thenReturn(Optional.of(notification));

        notificationService.markAsRead(42L, 7L);

        verify(notificationRepository).save(notification);
    }
}
