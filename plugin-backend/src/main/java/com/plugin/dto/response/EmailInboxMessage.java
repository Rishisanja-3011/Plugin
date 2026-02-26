package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class EmailInboxMessage {
    private String subject;
    private String body;
    private String otp;
    private LocalDateTime time;
}
