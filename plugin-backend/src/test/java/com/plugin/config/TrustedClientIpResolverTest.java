package com.plugin.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TrustedClientIpResolverTest {

    @Test
    void ignoresForwardedHeadersFromUntrustedPeers() {
        TrustedClientIpResolver resolver = new TrustedClientIpResolver("");
        MockHttpServletRequest request = request("203.0.113.10", "198.51.100.7");

        assertThat(resolver.resolve(request)).isEqualTo("203.0.113.10");
    }

    @Test
    void walksForwardedChainOnlyBehindConfiguredProxy() {
        TrustedClientIpResolver resolver = new TrustedClientIpResolver("10.0.0.0/8");
        MockHttpServletRequest request = request("10.0.0.5", "198.51.100.7, 10.0.0.4");

        assertThat(resolver.resolve(request)).isEqualTo("198.51.100.7");
    }

    @Test
    void invalidForwardedChainFallsBackToSocketPeer() {
        TrustedClientIpResolver resolver = new TrustedClientIpResolver("10.0.0.0/8");
        MockHttpServletRequest request = request("10.0.0.5", "attacker.example");

        assertThat(resolver.resolve(request)).isEqualTo("10.0.0.5");
    }

    @Test
    void rejectsInvalidTrustedProxyConfiguration() {
        assertThatThrownBy(() -> new TrustedClientIpResolver("10.0.0.0/99"))
                .isInstanceOf(IllegalStateException.class);
    }

    private MockHttpServletRequest request(String remoteAddress, String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddress);
        request.addHeader("X-Forwarded-For", forwardedFor);
        return request;
    }
}
