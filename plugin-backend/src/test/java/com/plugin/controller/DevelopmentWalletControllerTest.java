package com.plugin.controller;

import com.plugin.service.WalletService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class DevelopmentWalletControllerTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(DevelopmentWalletController.class)
            .withBean(WalletService.class, () -> mock(WalletService.class));

    @Test
    void testPaymentRouteControllerIsAbsentInProduction() {
        contextRunner.withPropertyValues("app.production=true")
                .run(context -> assertThat(context)
                        .doesNotHaveBean(DevelopmentWalletController.class));
    }

    @Test
    void testPaymentRouteControllerIsAvailableOutsideProduction() {
        contextRunner.withPropertyValues("app.production=false")
                .run(context -> assertThat(context)
                        .hasSingleBean(DevelopmentWalletController.class));
    }
}
