package com.plugin.service;

import com.plugin.dto.request.ChargingOptionsRequest;
import com.plugin.dto.response.EnergyResponses.ChargingOptions;
import com.plugin.entity.*;
import com.plugin.enums.*;
import com.plugin.repository.*;
import com.plugin.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StationChargingOptionsServiceTest {
    @Test void resolvesRegionCapacityAndTariffFromStationInsteadOfClient() {
        var stations = mock(StationRepository.class);
        var points = mock(ChargingPointRepository.class);
        var pricing = mock(PricingRepository.class);
        var optimizer = mock(ChargingOptimizationService.class);
        var service = new StationChargingOptionsService(stations, points, pricing, optimizer);
        var request = new ChargingOptionsRequest();
        request.setStationId(3L); request.setChargerPowerKw(BigDecimal.valueOf(60));
        request.setStationAvailableCapacityKw(BigDecimal.valueOf(5000)); request.setGridRegion("IN-WE");
        when(stations.findByIdAndActiveTrue(3L)).thenReturn(Optional.of(Station.builder().id(3L).state("Karnataka").build()));
        when(points.findByStationId(3L)).thenReturn(List.of(ChargingPoint.builder().id(2L).pointType(PointType.FAST).maxPowerKw(60.0).status(PointStatus.AVAILABLE).build(),
                ChargingPoint.builder().id(4L).pointType(PointType.FAST).maxPowerKw(120.0).status(PointStatus.OUT_OF_SERVICE).build()));
        when(pricing.findByStationIdAndPointType(3L, PointType.FAST)).thenReturn(Optional.of(Pricing.builder().ratePerUnit(BigDecimal.valueOf(15)).build()));
        when(optimizer.options(request)).thenReturn(ChargingOptions.builder().disclaimer("Forecast.").build());
        service.options(request);
        assertEquals("IN-SR", request.getGridRegion());
        assertEquals(0, BigDecimal.valueOf(60).compareTo(request.getStationAvailableCapacityKw()));
        assertEquals(BigDecimal.valueOf(15), request.getStationTariff());
        request.setChargingPointId(4L);
        assertThrows(BadRequestException.class, () -> service.options(request));
    }
}
