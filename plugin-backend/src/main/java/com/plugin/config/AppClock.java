package com.plugin.config;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.ZoneId;

public final class AppClock {

    public static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Kolkata");
    public static final ZoneId UTC_ZONE = ZoneOffset.UTC;

    private AppClock() {
    }

    public static LocalDate today() {
        return LocalDate.now(BUSINESS_ZONE);
    }

    public static LocalDateTime now() {
        return LocalDateTime.now(BUSINESS_ZONE);
    }

    public static LocalDateTime utcNow() {
        return LocalDateTime.now(UTC_ZONE);
    }

    public static LocalDateTime utcToBusiness(LocalDateTime value) {
        if (value == null) {
            return null;
        }
        return value.atZone(UTC_ZONE)
                .withZoneSameInstant(BUSINESS_ZONE)
                .toLocalDateTime();
    }

    public static LocalDateTime toStoredScheduleTime(LocalDateTime wallClockTime) {
        if (wallClockTime == null) {
            return null;
        }
        return wallClockTime.atZone(UTC_ZONE)
                .withZoneSameInstant(ZoneId.systemDefault())
                .toLocalDateTime();
    }

    public static LocalDateTime fromStoredScheduleTime(LocalDateTime storedTime) {
        if (storedTime == null) {
            return null;
        }
        return storedTime.atZone(ZoneId.systemDefault())
                .withZoneSameInstant(UTC_ZONE)
                .toLocalDateTime();
    }
}
