package com.plugin.config;

import com.plugin.controller.StationManagerApplicationController;
import com.plugin.dto.response.StationManagerReferenceDataResponse;
import com.plugin.service.StationManagerApplicationService;
import com.plugin.repository.UserRepository;
import com.plugin.service.SecurityRateLimitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = StationManagerApplicationController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, SecurityRateLimitFilter.class, TrustedClientIpResolver.class})
class StationManagerSecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StationManagerApplicationService stationManagerApplicationService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private SecurityRateLimitService securityRateLimitService;

    @BeforeEach
    void setUp() {
        when(securityRateLimitService.consume(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyInt(),
                org.mockito.ArgumentMatchers.any()))
                .thenReturn(SecurityRateLimitService.Decision.allowed());
        when(stationManagerApplicationService.getReferenceData()).thenReturn(
                StationManagerReferenceDataResponse.builder()
                        .businessRules(List.of())
                        .build()
        );
        when(jwtService.parseToken(anyString())).thenReturn(Optional.empty());
    }

    @Test
    void shouldAllowUnauthenticatedReferenceDataAccess() throws Exception {
        mockMvc.perform(get("/api/station-manager/reference-data"))
                .andExpect(status().isOk());
    }

    @Test
    void shouldAllowReferenceDataAccessWhenAStaleTokenIsPresent() throws Exception {
        mockMvc.perform(get("/api/station-manager/reference-data")
                        .header("Authorization", "Bearer stale-token"))
                .andExpect(status().isOk());
    }

    @Test
    void shouldKeepPrivateStationManagerRoutesProtected() throws Exception {
        mockMvc.perform(get("/api/station-manager/application"))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldProtectStatusLookup() throws Exception {
        mockMvc.perform(get("/api/station-manager/status/12345678901"))
                .andExpect(status().isForbidden());
    }
}
