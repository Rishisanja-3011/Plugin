package com.plugin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class WalletPaymentVerificationRequest {

    @NotBlank
    @Size(max = 128)
    private String razorpayOrderId;

    @NotBlank
    @Size(max = 128)
    private String razorpayPaymentId;

    @NotBlank
    @Size(max = 256)
    private String razorpaySignature;
}
