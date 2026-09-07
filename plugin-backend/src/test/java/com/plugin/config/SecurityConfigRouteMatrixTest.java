package com.plugin.config;

import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.repository.UserRepository;
import com.plugin.service.SecurityRateLimitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SecurityRouteProbeController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, SecurityRateLimitFilter.class, TrustedClientIpResolver.class})
@TestPropertySource(properties = "app.cors.allowed-origins=http://localhost:5173")
class SecurityConfigRouteMatrixTest {

    @Autowired
    private MockMvc mockMvc;

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
        configureIdentity("customer", 1L, Role.CUSTOMER);
        configureIdentity("operator", 2L, Role.STATION_OPERATOR);
        configureIdentity("admin", 3L, Role.ADMIN);
    }

    @Test
    void exposesOnlyExactPublicMethods() throws Exception {
        mockMvc.perform(post("/api/auth/login")).andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/login")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/station-manager/reference-data")).andExpect(status().isOk());
        mockMvc.perform(post("/api/station-manager/access/setup")).andExpect(status().isOk());
        mockMvc.perform(get("/api/stations/1")).andExpect(status().isOk());
        mockMvc.perform(post("/api/stations/1")).andExpect(status().isForbidden());
    }

    @Test
    void restrictsApplicantRoutesToCustomerAndOperator() throws Exception {
        assertAllowed(get("/api/station-manager/status/12345678901"), "customer");
        assertAllowed(get("/api/station-manager/status/12345678901"), "operator");
        mockMvc.perform(get("/api/station-manager/status/12345678901"))
                .andExpect(status().isForbidden());
        assertForbidden(get("/api/station-manager/status/12345678901"), "admin");

        assertAllowed(post("/api/station-manager/application"), "customer");
        assertAllowed(post("/api/station-manager/application"), "operator");
        assertForbidden(post("/api/station-manager/application"), "admin");
    }

    @Test
    void restrictsCustomerResourceNamespacesToCustomers() throws Exception {
        for (String path : new String[]{"/api/bookings/1", "/api/sessions/1", "/api/bills/1", "/api/wallet"}) {
            assertAllowed(get(path), "customer");
            assertForbidden(get(path), "operator");
            assertForbidden(get(path), "admin");
        }
    }

    @Test
    void enforcesAdminAndOperatorManagementRoles() throws Exception {
        assertAllowed(get("/api/admin/stations"), "operator");
        assertAllowed(get("/api/admin/stations"), "admin");
        assertForbidden(get("/api/admin/stations"), "customer");

        assertAllowed(get("/api/admin/station-manager-applications"), "admin");
        assertForbidden(get("/api/admin/station-manager-applications"), "operator");
        assertForbidden(get("/api/admin/station-manager-applications"), "customer");
    }

    @Test
    void keepsProfileAndNotificationsAuthenticated() throws Exception {
        for (String roleToken : new String[]{"customer", "operator", "admin"}) {
            assertAllowed(get("/api/profile"), roleToken);
            assertAllowed(get("/api/notifications"), roleToken);
        }
        mockMvc.perform(get("/api/profile")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/notifications")).andExpect(status().isForbidden());
    }

    private void configureIdentity(String token, Long userId, Role role) {
        String email = token + "@example.test";
        when(jwtService.parseToken(token)).thenReturn(Optional.of(
                new JwtService.TokenIdentity(userId, email, role.name(), 0L)));
        when(userRepository.findById(userId)).thenReturn(Optional.of(User.builder()
                .id(userId)
                .email(email)
                .password("not-used")
                .role(role)
                .active(true)
                .tokenVersion(0L)
                .build()));
    }

    private void assertAllowed(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
                               String token) throws Exception {
        mockMvc.perform(request.header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    private void assertForbidden(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
                                 String token) throws Exception {
        mockMvc.perform(request.header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

}
