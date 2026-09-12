package com.plugin.service;

import com.plugin.dto.response.EnergyResponses.GridPoint;
import com.plugin.entity.ChargingPoint;
import com.plugin.entity.Station;
import com.plugin.entity.User;
import com.plugin.enums.PointStatus;
import com.plugin.repository.ChargingPointRepository;
import com.plugin.repository.StationRepository;
import com.plugin.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StationRecommendationServiceTest {
    @Test
    void ranksAvailableStationsByRegionalRenewableShareAndNotifiesCustomer() {
        StationRepository stations = mock(StationRepository.class);
        ChargingPointRepository points = mock(ChargingPointRepository.class);
        UserRepository users = mock(UserRepository.class);
        RenewableEnergyService energy = mock(RenewableEnergyService.class);
        NotificationService notifications = mock(NotificationService.class);
        StationRecommendationService service = new StationRecommendationService(
                stations, points, users, energy, notifications);

        User customer = User.builder().id(7L).email("driver@example.com").build();
        Station gujarat = Station.builder().id(1L).name("Gujarat Hub").state("Gujarat").active(true).build();
        Station delhi = Station.builder().id(2L).name("Delhi Hub").state("Delhi").active(true).build();
        when(users.findByEmailIgnoreCase(customer.getEmail())).thenReturn(Optional.of(customer));
        when(stations.findByActiveTrue()).thenReturn(List.of(delhi, gujarat));
        when(points.findByStationId(1L)).thenReturn(List.of(availablePoint(1L), availablePoint(2L)));
        when(points.findByStationId(2L)).thenReturn(List.of(availablePoint(3L)));
        when(energy.current("IN-WE")).thenReturn(outlook("IN-WE", "55"));
        when(energy.current("IN-NR")).thenReturn(outlook("IN-NR", "35"));

        var result = service.recommend(customer.getEmail());

        assertEquals(List.of(1L, 2L), result.stream().map(item -> item.getStationId()).toList());
        assertEquals(2, result.get(0).getAvailablePoints());
        verify(notifications).sendIfNew(eq(7L), eq("Greener charging window available"),
                contains("Gujarat Hub"), any());
    }

    @Test
    void returnsAnEmptyRankingInsteadOfBreakingStationBrowsingWhenProviderIsDown() {
        StationRepository stations = mock(StationRepository.class);
        ChargingPointRepository points = mock(ChargingPointRepository.class);
        UserRepository users = mock(UserRepository.class);
        RenewableEnergyService energy = mock(RenewableEnergyService.class);
        NotificationService notifications = mock(NotificationService.class);
        StationRecommendationService service = new StationRecommendationService(
                stations, points, users, energy, notifications);
        User customer = User.builder().id(7L).email("driver@example.com").build();
        when(users.findByEmailIgnoreCase(customer.getEmail())).thenReturn(Optional.of(customer));
        when(stations.findByActiveTrue()).thenReturn(List.of(
                Station.builder().id(1L).name("Gujarat Hub").state("Gujarat").active(true).build()));
        when(energy.current("IN-WE")).thenThrow(new IllegalStateException("provider unavailable"));

        assertEquals(List.of(), service.recommend(customer.getEmail()));
        verifyNoInteractions(notifications);
    }

    private static ChargingPoint availablePoint(long id) {
        return ChargingPoint.builder().id(id).status(PointStatus.AVAILABLE).build();
    }

    private static GridPoint outlook(String region, String share) {
        return GridPoint.builder().gridRegion(region).renewableSharePercent(new BigDecimal(share))
                .dataMode("LIVE").build();
    }
}
