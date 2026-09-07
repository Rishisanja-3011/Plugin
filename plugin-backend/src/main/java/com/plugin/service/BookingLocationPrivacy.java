package com.plugin.service;

import com.plugin.entity.Booking;

/** Removes precise customer coordinates once an ETA workflow has terminated. */
final class BookingLocationPrivacy {

    private BookingLocationPrivacy() {}

    static void clearPreciseLocation(Booking booking) {
        if (booking == null) {
            return;
        }
        booking.setOriginLatitude(null);
        booking.setOriginLongitude(null);
        booking.setLastKnownLatitude(null);
        booking.setLastKnownLongitude(null);
        booking.setLastLocationPingAt(null);
        booking.setLastDistanceMeters(null);
    }
}
