package com.example.kyc.auth;

import com.example.kyc.role.Role;
import com.example.kyc.role.RoleRepository;
import com.example.kyc.user.UserAccount;
import com.example.kyc.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthAndAuthorizationApiTest {
    private static final String PASSWORD = "Test-Password-21!";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository users;
    @Autowired
    private RoleRepository roles;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private ObjectMapper objectMapper;

    private UserAccount admin;

    @BeforeEach
    void createAdminAccount() {
        Role role = roles.findByRoleCode("API_CLIENT_ADMIN")
            .orElseGet(() -> roles.save(new Role("API_CLIENT_ADMIN")));
        String email = "admin-" + UUID.randomUUID() + "@example.test";
        admin = users.save(new UserAccount(email, passwordEncoder.encode(PASSWORD),
            "Fictional Test Administrator", Set.of(role)));
    }

    @Test
    void loginMeAndLogoutUseRevocableCookieSession() throws Exception {
        Csrf csrf = fetchCsrf();
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                .cookie(csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new AuthController.LoginRequest(admin.getEmail(), PASSWORD))))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andReturn();

        Cookie session = login.getResponse().getCookie(SessionAuthenticationFilter.COOKIE_NAME);
        assertNotNull(session);
        mockMvc.perform(get("/api/v1/auth/me").cookie(session))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"email\":\"" + admin.getEmail() + "\"}"));

        mockMvc.perform(post("/api/v1/auth/logout")
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/auth/me").cookie(session))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void apiClientAdministratorCannotAccessBusinessData() throws Exception {
        Csrf csrf = fetchCsrf();
        Cookie session = login(admin.getEmail(), PASSWORD, csrf);

        mockMvc.perform(post("/api/v1/customers")
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"displayName":"Fictional Customer","email":"customer@example.test"}
                    """))
            .andExpect(status().isForbidden())
            .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void failedLoginReturnsGenericUnauthorized() throws Exception {
        Csrf csrf = fetchCsrf();

        mockMvc.perform(post("/api/v1/auth/login")
                .cookie(csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(
                    new AuthController.LoginRequest(admin.getEmail(), "Wrong-Password-21!"))))
            .andExpect(status().isUnauthorized())
            .andExpect(content().json("{\"detail\":\"Invalid email or password\"}"));
    }

    private Cookie login(String email, String password, Csrf csrf) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                .cookie(csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new AuthController.LoginRequest(email, password))))
            .andExpect(status().isOk())
            .andReturn();
        return result.getResponse().getCookie(SessionAuthenticationFilter.COOKIE_NAME);
    }

    private Csrf fetchCsrf() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/auth/csrf"))
            .andExpect(status().isOk())
            .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return new Csrf(cookie, body.get("token").asText());
    }

    private record Csrf(Cookie cookie, String token) {
    }
}
