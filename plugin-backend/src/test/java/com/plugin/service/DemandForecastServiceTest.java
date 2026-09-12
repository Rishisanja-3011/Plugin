package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.DemandForecastPoint;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DemandForecastServiceTest {
    @Test
    void producesBoundedCapacityAwareModelForecast() {
        List<DemandForecastPoint> points = new DemandForecastService()
                .forecast(7L, BigDecimal.valueOf(200), 24);

        assertThat(points).hasSize(25);
        assertThat(points).allSatisfy(point -> {
            assertThat(point.getStationId()).isEqualTo(7L);
            assertThat(point.getStationCapacityKw()).isEqualByComparingTo("200.00");
            assertThat(point.getExpectedChargingDemandKw()).isGreaterThanOrEqualTo(BigDecimal.ZERO);
            assertThat(point.getDataMode()).isEqualTo("FORECAST");
            assertThat(point.getSource()).contains("time-of-day");
        });
    }
}
