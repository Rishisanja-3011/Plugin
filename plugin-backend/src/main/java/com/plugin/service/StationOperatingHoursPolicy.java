package com.plugin.service;

import com.plugin.entity.Station;
import com.plugin.exception.BadRequestException;

import java.time.LocalDateTime;
import java.time.LocalTime;

/** Zone-local operating-window validation, including windows spanning midnight. */
final class StationOperatingHoursPolicy {

    private StationOperatingHoursPolicy() {
    }

    static void validate(Station station, LocalDateTime start, LocalDateTime end) {
        if (station == null || start == null || end == null || !end.isAfter(start)) {
            throw new BadRequestException("A valid booking time range is required");
        }
        LocalTime open = station.getOpeningTime();
        LocalTime close = station.getClosingTime();
        if (open == null || close == null) {
            throw new BadRequestException("Station operating hours are not configured");
        }
        if (open.equals(close)) {
            return; // Explicit 24-hour schedule.
        }

        LocalDateTime windowStart;
        LocalDateTime windowEnd;
        if (close.isAfter(open)) {
            windowStart = start.toLocalDate().atTime(open);
            windowEnd = start.toLocalDate().atTime(close);
        } else if (!start.toLocalTime().isBefore(open)) {
            windowStart = start.toLocalDate().atTime(open);
            windowEnd = start.toLocalDate().plusDays(1).atTime(close);
        } else {
            windowStart = start.toLocalDate().minusDays(1).atTime(open);
            windowEnd = start.toLocalDate().atTime(close);
        }

        if (start.isBefore(windowStart) || end.isAfter(windowEnd)) {
            throw new BadRequestException("Booking must be within station operating hours: "
                    + open + " - " + close);
        }
    }
}
