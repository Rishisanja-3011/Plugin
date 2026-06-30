package com.plugin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class RazorpayOrderResponse {
    private Long billId;
    private String keyId;
    private String orderId;
    private Integer amountInPaise;
    private BigDecimal amount;
    private String currency;
    private String receipt;
    private String name;
    private String description;
    private String customerName;
    private String customerEmail;
    private String customerContact;
}
