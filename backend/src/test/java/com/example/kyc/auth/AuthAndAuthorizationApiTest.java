package com.example.kyc.auth;

import com.example.kyc.audit.AuditEvent;
import com.example.kyc.audit.AuditEventRepository;
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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthAndAuthorizationApiTest {
    private static final String PASSWORD = "Test-Password-21!";
    private static final java.util.concurrent.atomic.AtomicInteger LOGIN_SOURCE = new java.util.concurrent.atomic.AtomicInteger();

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository users;
    @Autowired
    private AuditEventRepository auditEvents;
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
        assertTrue(session.isHttpOnly());
        assertTrue(login.getResponse().getHeader("Set-Cookie").contains("SameSite=Strict"));
        mockMvc.perform(get("/api/v1/auth/me").cookie(session))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string("X-Frame-Options", "DENY"))
            .andExpect(content().json("{\"email\":\"" + admin.getEmail() + "\"}"));

        mockMvc.perform(post("/api/v1/auth/logout")
                .cookie(session, csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/auth/me").cookie(session))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpointsRequireAuthenticationAndLoginRequiresCsrf() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/customers"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/auth/csrf").header("Origin", "https://untrusted.example"))
            .andExpect(status().isOk())
            .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));

        Csrf csrf = fetchCsrf();
        mockMvc.perform(post("/api/v1/auth/login")
                .cookie(csrf.cookie())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new AuthController.LoginRequest(admin.getEmail(), PASSWORD))))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/auth/login")
                .cookie(csrf.cookie())
                .header(csrf.headerName(), "invalid-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new AuthController.LoginRequest(admin.getEmail(), PASSWORD))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
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
            .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
            .andExpect(jsonPath("$.code").doesNotExist());
    }

    @Test
    void supervisorDirectoryAndAuditBrowserEnforceTheirDistinctRoles() throws Exception {
        UserAccount supervisor = createUser("COMPLIANCE_SUPERVISOR");
        UserAccount analyst = createUser("KYC_ANALYST");
        Csrf csrf = fetchCsrf();
        Cookie adminSession = login(admin.getEmail(), PASSWORD, csrf);
        Cookie supervisorSession = login(supervisor.getEmail(), PASSWORD, csrf);
        auditEvents.save(new AuditEvent(admin, "API_CLIENT_ADMIN", "SYNTHETIC_AUDIT_EVENT",
            "KYC_CASE", UUID.randomUUID().toString(), "SUCCESS", "private-correlation-value"));

        mockMvc.perform(get("/api/v1/supervisor/analysts").cookie(adminSession))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/supervisor/analysts")
                .param("search", "Fictional KYC_ANALYST")
                .param("page", "0")
                .param("size", "10")
                .cookie(supervisorSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].id").value(analyst.getId()))
            .andExpect(jsonPath("$.content[0].displayName").value("Fictional KYC_ANALYST"))
            .andExpect(jsonPath("$.content[0].email").doesNotExist());

        mockMvc.perform(get("/api/v1/admin/audit-events").cookie(supervisorSession))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/audit-events").cookie(adminSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.content[0].correlationId").doesNotExist());
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
                .with(request -> {
                    request.setRemoteAddr("198.51.100." + (LOGIN_SOURCE.incrementAndGet() % 254 + 1));
                    return request;
                })
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
        return new Csrf(cookie, body.get("headerName").asText(), body.get("token").asText());
    }

    private UserAccount createUser(String roleCode) {
        Role role = roles.findByRoleCode(roleCode)
            .orElseGet(() -> roles.save(new Role(roleCode)));
        return users.save(new UserAccount(roleCode.toLowerCase() + "-" + UUID.randomUUID() + "@example.test",
            passwordEncoder.encode(PASSWORD), "Fictional " + roleCode, Set.of(role)));
    }

    private record Csrf(Cookie cookie, String headerName, String token) {
    }
}
