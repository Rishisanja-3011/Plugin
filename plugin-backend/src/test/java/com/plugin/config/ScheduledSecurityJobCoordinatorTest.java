package com.plugin.config;

import com.plugin.service.BookingService;
import com.plugin.service.DistributedJobLockService;
import com.plugin.service.SessionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduledSecurityJobCoordinatorTest {

    @Mock private DistributedJobLockService jobLockService;
    @Mock private BookingService bookingService;
    @Mock private SessionService sessionService;
    @InjectMocks private ScheduledSecurityJobCoordinator coordinator;

    @Test
    void runsAndReleasesJobOnlyWhenThisNodeAcquiresTheLease() {
        when(jobLockService.tryAcquire("booking-expiry", Duration.ofMinutes(2))).thenReturn(true);

        coordinator.expireMissedBookings();

        verify(bookingService).expireMissedBookings();
        verify(jobLockService).release("booking-expiry");
    }

    @Test
    void skipsJobWhenAnotherNodeOwnsTheLease() {
        when(jobLockService.tryAcquire("wallet-balance-monitor", Duration.ofSeconds(30))).thenReturn(false);

        coordinator.monitorActiveWalletBalances();

        verify(sessionService, never()).monitorActiveWalletBalances();
        verify(jobLockService, never()).release("wallet-balance-monitor");
    }
}
