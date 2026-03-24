package com.plugin.config;

import com.plugin.controller.StationManagerApplicationController;
import com.plugin.dto.response.StationManagerReferenceDataResponse;
import com.plugin.service.StationManagerApplicationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = StationManagerApplicationController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class})
class StationManagerSecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StationManagerApplicationService stationManagerApplicationService;

    @MockBean
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        when(stationManagerApplicationService.getReferenceData()).thenReturn(
                StationManagerReferenceDataResponse.builder()
                        .businessRules(List.of())
                        .build()
        );
        when(jwtService.isTokenValid(anyString())).thenReturn(false);
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
}
