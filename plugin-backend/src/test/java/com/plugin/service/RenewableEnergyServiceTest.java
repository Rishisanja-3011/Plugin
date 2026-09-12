package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.GridPoint;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RenewableEnergyServiceTest {
    @Test
    void backsOffAfterFailureAndRejectsUnknownRegionsBeforeCallingProvider() {
        DemoGridDataProvider demo = new DemoGridDataProvider();
        AtomicInteger calls = new AtomicInteger();
        GridDataProvider failing = new GridDataProvider() {
            public String id() { return "external"; }
            public List<GridPoint> forecast(String region, LocalDateTime from, int hours) {
                calls.incrementAndGet();
                throw new IllegalStateException("unavailable");
            }
        };
        RenewableEnergyService service = new RenewableEnergyService(List.of(failing), demo, "external", "IN-WE", 300);
        assertThatThrownBy(() -> service.current("IN-WE")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> service.current("IN-WE")).isInstanceOf(IllegalStateException.class);
        assertThat(calls).hasValue(1);
        assertThatThrownBy(() -> service.current("UNKNOWN")).isInstanceOf(com.plugin.exception.BadRequestException.class);
        assertThat(calls).hasValue(1);
    }
    @Test
    void failsClosedWhenExternalProviderFailsWithoutCachedData() {
        DemoGridDataProvider demo = new DemoGridDataProvider();
        GridDataProvider failing = new GridDataProvider() {
            public String id() { return "external"; }
            public List<GridPoint> forecast(String region, LocalDateTime from, int hours) {
                throw new IllegalStateException("rate limited");
            }
        };
        RenewableEnergyService service = new RenewableEnergyService(List.of(demo, failing), demo, "external", "IN-WE", 300);

        assertThatThrownBy(() -> service.current("IN-SR"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("temporarily unavailable");
    }

    @Test
    void cachesAProviderResultToProtectQuota() {
        DemoGridDataProvider demo = new DemoGridDataProvider();
        AtomicInteger calls = new AtomicInteger();
        GridDataProvider counting = new GridDataProvider() {
            public String id() { return "external"; }
            public List<GridPoint> forecast(String region, LocalDateTime from, int hours) {
                calls.incrementAndGet();
                return demo.forecast(region, from, hours);
            }
        };
        RenewableEnergyService service = new RenewableEnergyService(List.of(demo, counting), demo, "external", "IN-WE", 300);

        service.forecast("IN-WE", 24);
        service.forecast("IN-WE", 24);

        assertThat(calls).hasValue(1);
    }

    @Test
    void externalProviderFailsClosedWithoutServerSideConfiguration() {
        ExternalGridDataProvider provider = new ExternalGridDataProvider(
                RestClient.builder(), "", "", 3000, 5000);

        assertThatThrownBy(() -> provider.forecast("IN-WE", LocalDateTime.now(), 24))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not configured");
    }
}
