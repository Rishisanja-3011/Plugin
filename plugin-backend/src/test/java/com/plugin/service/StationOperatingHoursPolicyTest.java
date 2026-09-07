package com.plugin.service;

import com.plugin.entity.Station;
import com.plugin.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StationOperatingHoursPolicyTest {

    @Test
    void rejectsBookingThatRunsPastNormalClosingTime() {
        Station station = station(LocalTime.of(6, 0), LocalTime.of(23, 0));

        assertThrows(BadRequestException.class, () -> StationOperatingHoursPolicy.validate(
                station,
                LocalDateTime.of(2026, 8, 9, 22, 30),
                LocalDateTime.of(2026, 8, 9, 23, 30)));
    }

    @Test
    void acceptsBookingInsideOvernightWindow() {
        Station station = station(LocalTime.of(22, 0), LocalTime.of(6, 0));

        assertDoesNotThrow(() -> StationOperatingHoursPolicy.validate(
                station,
                LocalDateTime.of(2026, 8, 9, 23, 0),
                LocalDateTime.of(2026, 8, 10, 1, 0)));
    }

    @Test
    void rejectsDaytimeBookingForOvernightStation() {
        Station station = station(LocalTime.of(22, 0), LocalTime.of(6, 0));

        assertThrows(BadRequestException.class, () -> StationOperatingHoursPolicy.validate(
                station,
                LocalDateTime.of(2026, 8, 9, 12, 0),
                LocalDateTime.of(2026, 8, 9, 13, 0)));
    }

    @Test
    void equalOpeningAndClosingTimesRepresentTwentyFourHours() {
        Station station = station(LocalTime.MIDNIGHT, LocalTime.MIDNIGHT);

        assertDoesNotThrow(() -> StationOperatingHoursPolicy.validate(
                station,
                LocalDateTime.of(2026, 8, 9, 23, 30),
                LocalDateTime.of(2026, 8, 10, 1, 0)));
    }

    private Station station(LocalTime opening, LocalTime closing) {
        return Station.builder()
                .id(1L)
                .name("Test Station")
                .active(true)
                .openingTime(opening)
                .closingTime(closing)
                .build();
    }
}
