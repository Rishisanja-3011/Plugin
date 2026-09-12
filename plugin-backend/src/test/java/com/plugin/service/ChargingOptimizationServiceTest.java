package com.plugin.service;

import com.plugin.dto.request.ChargingOptionsRequest;
import com.plugin.dto.response.EnergyResponses.ChargingOptions;
import com.plugin.entity.GridSignal;
import com.plugin.enums.ChargingPreference;
import com.plugin.exception.BadRequestException;
import com.plugin.repository.GridSignalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ChargingOptimizationServiceTest {
    private ChargingOptimizationService service;
    private GridSignalRepository gridSignalRepository;

    @BeforeEach
    void setUp() {
        DemoGridDataProvider demo = new DemoGridDataProvider();
        RenewableEnergyService energy = new RenewableEnergyService(List.of(demo), demo, "demo", "IN-WE", 300);
        gridSignalRepository = mock(GridSignalRepository.class);
        when(gridSignalRepository.findTop20ByGridRegionOrderByCreatedAtDesc(anyString())).thenReturn(List.of());
        service = new ChargingOptimizationService(energy, gridSignalRepository);
    }

    @Test
    void returnsAllStrategiesWithRequestedPreferenceFirstAndCapacityApplied() {
        ChargingOptionsRequest request = validRequest();
        request.setPreference(ChargingPreference.GREENEST);
        request.setChargerPowerKw(BigDecimal.valueOf(60));
        request.setStationAvailableCapacityKw(BigDecimal.valueOf(30));

        ChargingOptions result = service.options(request);

        assertThat(result.getOptions()).extracting("scheduleType")
                .containsExactly("GREENEST", "CHEAPEST", "FASTEST", "BALANCED");
        assertThat(result.getOptions()).allSatisfy(option -> {
            assertThat(option.getChargingPowerKw()).isEqualByComparingTo("30.00");
            assertThat(option.getGreenScore()).isBetween(0, 100);
            assertThat(option.getEndTime()).isAfter(option.getStartTime());
            assertThat(option.getDataMode()).isEqualTo("DEMO");
        });
        assertThat(result.getDisclaimer()).contains("SIMULATED");
    }

    @Test
    void rejectsAWindowThatCannotDeliverTheRequestedEnergy() {
        ChargingOptionsRequest request = validRequest();
        request.setRequiredEnergyKwh(BigDecimal.valueOf(120));
        request.setLatestEndTime(request.getEarliestStartTime().plusHours(1));

        assertThatThrownBy(() -> service.options(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("too short");
    }

    @Test
    void isRepeatableAndSupportsAnOvernightWindow() {
        ChargingOptionsRequest request = validRequest();
        LocalDateTime tonight = LocalDateTime.now().plusDays(1).withHour(20).withMinute(0).withSecond(0).withNano(0);
        request.setEarliestStartTime(tonight);
        request.setLatestEndTime(tonight.plusHours(10));

        ChargingOptions first = service.options(request);
        ChargingOptions second = service.options(request);

        assertThat(second.getOptions()).usingRecursiveFieldByFieldElementComparator()
                .containsExactlyElementsOf(first.getOptions());
        assertThat(first.getOptions()).allSatisfy(option ->
                assertThat(option.getEndTime()).isBeforeOrEqualTo(request.getLatestEndTime()));
    }

    @Test
    void excludesWindowsThatViolateAnActiveGridReductionSignal() {
        ChargingOptionsRequest request = validRequest();
        when(gridSignalRepository.findTop20ByGridRegionOrderByCreatedAtDesc("IN-WE")).thenReturn(List.of(
                GridSignal.builder()
                        .gridRegion("IN-WE")
                        .signalType("REDUCE_LOAD")
                        .requestedReductionPercent(100)
                        .startsAt(request.getEarliestStartTime().minusMinutes(5))
                        .endsAt(request.getLatestEndTime().plusMinutes(5))
                        .build()
        ));

        assertThatThrownBy(() -> service.options(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("grid-capacity signals");
    }

    private static ChargingOptionsRequest validRequest() {
        LocalDateTime start = LocalDateTime.now().plusHours(1).withSecond(0).withNano(0);
        ChargingOptionsRequest request = new ChargingOptionsRequest();
        request.setStationId(1L);
        request.setGridRegion("IN-WE");
        request.setRequiredEnergyKwh(BigDecimal.valueOf(24));
        request.setEarliestStartTime(start);
        request.setLatestEndTime(start.plusHours(12));
        request.setChargerPowerKw(BigDecimal.valueOf(22));
        request.setStationAvailableCapacityKw(BigDecimal.valueOf(80));
        request.setPreference(ChargingPreference.BALANCED);
        return request;
    }
}
