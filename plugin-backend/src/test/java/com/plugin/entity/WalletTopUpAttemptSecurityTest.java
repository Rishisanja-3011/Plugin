package com.plugin.entity;

import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.index.Indexed;

import static org.assertj.core.api.Assertions.assertThat;

class WalletTopUpAttemptSecurityTest {

    @Test
    void providerPaymentIdHasUniqueSparseReplayProtectionIndex() throws Exception {
        Indexed indexed = WalletTopUpAttempt.class
                .getDeclaredField("razorpayPaymentId")
                .getAnnotation(Indexed.class);

        assertThat(indexed).isNotNull();
        assertThat(indexed.unique()).isTrue();
        assertThat(indexed.sparse()).isTrue();
        assertThat(indexed.name()).isEqualTo("uk_wallet_top_up_payment_id");
    }
}
