package com.plugin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class BookingRescheduleRequest {

    @NotNull(message = "Requested start time is required")
    private LocalDateTime startTime;

    @NotBlank(message = "Reschedule reason is required")
    @Size(max = 500, message = "Reschedule reason must be 500 characters or fewer")
    private String reason;
}
