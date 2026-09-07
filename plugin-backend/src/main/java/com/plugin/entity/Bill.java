package com.plugin.entity;

import com.plugin.enums.PaymentStatus;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "bills")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Bill {

    @Id
    private String mongoId;

    @Indexed(unique = true, sparse = true)
    private Long id;

    @Indexed(unique = true)
    private String invoiceNumber;

    private ChargingSession session;

    @Indexed(unique = true, sparse = true)
    private Long sessionId;

    @Version
    private Long version;

    private User customer;

    private Long customerId;

    private Station station;

    private Long stationId;

    private BigDecimal energyKwh;

    private Long durationMinutes;

    private Long durationSeconds;

    private BigDecimal rateApplied;

    private String rateType;

    private BigDecimal totalAmount;

    private PaymentStatus paymentStatus;

    private String razorpayOrderId;

    private String razorpayPaymentId;

    private String razorpaySignature;

    private LocalDateTime createdAt;

    private LocalDateTime paidAt;

    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (paymentStatus == null) paymentStatus = PaymentStatus.UNPAID;
    }
}
