package com.plugin.controller;

import com.plugin.dto.request.BookingCancelRequest;
import com.plugin.dto.request.BookingLocationPingRequest;
import com.plugin.dto.request.BookingRequest;
import com.plugin.dto.request.BookingRescheduleRequest;
import com.plugin.dto.response.BookingResponse;
import com.plugin.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(
            @Valid @RequestBody BookingRequest request,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(bookingService.createBooking(request, auth.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BookingResponse> modifyBooking(
            @PathVariable Long id,
            @Valid @RequestBody BookingRequest request,
            Authentication auth) {
        return ResponseEntity.ok(bookingService.modifyBooking(id, request, auth.getName()));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<BookingResponse> cancelBooking(
            @PathVariable Long id,
            @Valid @RequestBody BookingCancelRequest request,
            Authentication auth) {
        return ResponseEntity.ok(bookingService.cancelBooking(id, auth.getName(), request.getReason()));
    }

    @PostMapping("/{id}/location")
    public ResponseEntity<BookingResponse> updateBookingLocation(
            @PathVariable Long id,
            @Valid @RequestBody BookingLocationPingRequest request,
            Authentication auth) {
        return ResponseEntity.ok(bookingService.updateBookingLocation(id, request, auth.getName()));
    }

    @PostMapping("/{id}/reschedule-request")
    public ResponseEntity<BookingResponse> requestReschedule(
            @PathVariable Long id,
            @Valid @RequestBody BookingRescheduleRequest request,
            Authentication auth) {
        return ResponseEntity.ok(bookingService.requestReschedule(id, request, auth.getName()));
    }

    @GetMapping("/my")
    public ResponseEntity<Page<BookingResponse>> getMyBookings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication auth) {
        return ResponseEntity.ok(bookingService.getMyBookings(auth.getName(),
                PageRequest.of(page, size)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getBooking(@PathVariable Long id) {
        return ResponseEntity.ok(bookingService.getBookingById(id));
    }

}
