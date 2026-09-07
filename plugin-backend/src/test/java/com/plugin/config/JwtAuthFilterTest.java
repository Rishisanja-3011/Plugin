package com.plugin.config;

import com.plugin.entity.User;
import com.plugin.enums.Role;
import com.plugin.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtAuthFilterTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private UserRepository userRepository;

    private JwtAuthFilter filter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        filter = new JwtAuthFilter(jwtService, userRepository);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatesOnlyFromCurrentDatabaseIdentity() throws Exception {
        JwtService.TokenIdentity identity = identity(Role.CUSTOMER, 3L);
        when(jwtService.parseToken("valid-token")).thenReturn(Optional.of(identity));
        when(userRepository.findById(42L)).thenReturn(Optional.of(user(Role.CUSTOMER, true, 3L)));

        execute("valid-token");

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getName())
                .isEqualTo("current@example.test");
        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_CUSTOMER");
    }

    @Test
    void rejectsTokenForInactiveUser() throws Exception {
        when(jwtService.parseToken("token")).thenReturn(Optional.of(identity(Role.CUSTOMER, 3L)));
        when(userRepository.findById(42L)).thenReturn(Optional.of(user(Role.CUSTOMER, false, 3L)));

        execute("token");

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void rejectsTokenAfterRoleChange() throws Exception {
        when(jwtService.parseToken("token")).thenReturn(Optional.of(identity(Role.STATION_OPERATOR, 3L)));
        when(userRepository.findById(42L)).thenReturn(Optional.of(user(Role.CUSTOMER, true, 3L)));

        execute("token");

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void rejectsTokenAfterSessionVersionIsRevoked() throws Exception {
        User current = user(Role.CUSTOMER, true, 3L);
        current.revokeSessions();
        when(jwtService.parseToken("token")).thenReturn(Optional.of(identity(Role.CUSTOMER, 3L)));
        when(userRepository.findById(42L)).thenReturn(Optional.of(current));

        execute("token");

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void rejectsTokenAfterEmailIdentityChanges() throws Exception {
        when(jwtService.parseToken("token")).thenReturn(Optional.of(
                new JwtService.TokenIdentity(42L, "old@example.test", "CUSTOMER", 3L)));
        when(userRepository.findById(42L)).thenReturn(Optional.of(user(Role.CUSTOMER, true, 3L)));

        execute("token");

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    private void execute(String token) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        filter.doFilterInternal(request, new MockHttpServletResponse(), new MockFilterChain());
    }

    private JwtService.TokenIdentity identity(Role role, long tokenVersion) {
        return new JwtService.TokenIdentity(
                42L, "current@example.test", role.name(), tokenVersion);
    }

    private User user(Role role, boolean active, long tokenVersion) {
        return User.builder()
                .id(42L)
                .email("current@example.test")
                .password("not-used")
                .role(role)
                .active(active)
                .tokenVersion(tokenVersion)
                .build();
    }
}
