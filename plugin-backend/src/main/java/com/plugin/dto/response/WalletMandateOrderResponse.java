package com.plugin.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter @Builder
public class WalletMandateOrderResponse {
    private Long walletId;
    private String keyId;
    private String orderId;
    private String customerId;
    private Integer amountInPaise;
    private BigDecimal amount;
    private String currency;
    private String method;
    private String name;
    private String description;
    private String customerName;
    private String customerEmail;
    private String customerContact;
    private boolean recurring;
}
