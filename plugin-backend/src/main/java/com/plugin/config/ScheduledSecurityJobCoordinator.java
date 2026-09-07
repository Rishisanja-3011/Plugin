package com.plugin.config;

import com.plugin.service.BookingService;
import com.plugin.service.DistributedJobLockService;
import com.plugin.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class ScheduledSecurityJobCoordinator {

    private static final Duration BOOKING_JOB_LEASE = Duration.ofMinutes(2);
    private static final Duration SESSION_JOB_LEASE = Duration.ofSeconds(30);

    private final DistributedJobLockService jobLockService;
    private final BookingService bookingService;
    private final SessionService sessionService;

    @Scheduled(initialDelayString = "${app.notifications.booking-start-initial-delay-ms:10000}",
            fixedDelayString = "${app.notifications.booking-start-check-ms:30000}")
    public void sendBookingStartNotifications() {
        runWithLease("booking-start-notifications", BOOKING_JOB_LEASE,
                bookingService::sendBookingStartNotifications);
    }

    @Scheduled(initialDelayString = "${app.bookings.expiry-initial-delay-ms:15000}",
            fixedDelayString = "${app.bookings.expiry-check-ms:30000}")
    public void expireMissedBookings() {
        runWithLease("booking-expiry", BOOKING_JOB_LEASE, bookingService::expireMissedBookings);
    }

    @Scheduled(initialDelayString = "${app.sessions.auto-complete-initial-delay-ms:1000}",
            fixedRateString = "${app.sessions.auto-complete-check-ms:1000}")
    public void autoCompleteExpiredSessions() {
        runWithLease("session-auto-complete", SESSION_JOB_LEASE,
                sessionService::autoCompleteExpiredSessions);
    }

    @Scheduled(initialDelayString = "${app.wallet.monitor-initial-delay-ms:2000}",
            fixedRateString = "${app.wallet.monitor-check-ms:3000}")
    public void monitorActiveWalletBalances() {
        runWithLease("wallet-balance-monitor", SESSION_JOB_LEASE,
                sessionService::monitorActiveWalletBalances);
    }

    private void runWithLease(String jobName, Duration duration, Runnable job) {
        if (!jobLockService.tryAcquire(jobName, duration)) {
            return;
        }
        try {
            job.run();
        } finally {
            jobLockService.release(jobName);
        }
    }
}
