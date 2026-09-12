package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.GridPoint;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DemoGridDataProviderTest {
    private final DemoGridDataProvider provider = new DemoGridDataProvider();

    @Test
    void labelsSimulatedDataAndModelsHigherMiddayRenewables() {
        LocalDateTime midnight = LocalDateTime.of(2026, 9, 12, 0, 0);

        List<GridPoint> points = provider.forecast("in-we", midnight, 23);

        assertThat(points).hasSize(24);
        assertThat(points).allSatisfy(point -> {
            assertThat(point.getGridRegion()).isEqualTo("IN-WE");
            assertThat(point.getDataMode()).isEqualTo("DEMO");
            assertThat(point.getQuality()).isEqualTo("SIMULATED");
            assertThat(point.getRenewableSharePercent()).isBetween(
                    java.math.BigDecimal.TEN, java.math.BigDecimal.valueOf(88));
        });
        assertThat(points.get(12).getRenewableSharePercent())
                .isGreaterThan(points.get(19).getRenewableSharePercent());
    }

    @Test
    void producesRepeatableForecastValuesForTheSameInputs() {
        LocalDateTime from = LocalDateTime.of(2026, 9, 12, 8, 17);

        List<GridPoint> first = provider.forecast("IN-NR", from, 8);
        List<GridPoint> second = provider.forecast("IN-NR", from, 8);

        assertThat(second).usingRecursiveFieldByFieldElementComparatorIgnoringFields("generatedAt")
                .containsExactlyElementsOf(first);
    }
}
