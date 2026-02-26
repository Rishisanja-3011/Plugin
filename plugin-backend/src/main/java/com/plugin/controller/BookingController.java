package com.plugin.controller;

import com.plugin.dto.request.BookingRequest;
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

import java.time.LocalDate;
import java.util.List;

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

    @DeleteMapping("/{id}")
    public ResponseEntity<BookingResponse> cancelBooking(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(bookingService.cancelBooking(id, auth.getName()));
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

    @GetMapping("/available-slots")
    public ResponseEntity<List<String>> getAvailableSlots(
            @RequestParam Long stationId,
            @RequestParam Long pointId,
            @RequestParam String date) {
        return ResponseEntity.ok(bookingService.getAvailableSlots(
                stationId, pointId, LocalDate.parse(date)));
    }
}
