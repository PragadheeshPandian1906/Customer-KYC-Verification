package com.example.kyc.auth;

import com.example.kyc.audit.AuditService;
import com.example.kyc.common.ApiException;
import com.example.kyc.role.Role;
import com.example.kyc.user.UserAccount;
import com.example.kyc.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {
    @Test
    void successfulLoginPersistsOnlyHashedOpaqueSessionToken() {
        AuthenticationManager authentication = mock(AuthenticationManager.class);
        UserRepository users = mock(UserRepository.class);
        AuthSessionRepository sessions = mock(AuthSessionRepository.class);
        AuditService audit = mock(AuditService.class);
        UserAccount user = new UserAccount("analyst@example.test", "bcrypt-hash", "Fictional Analyst",
            Set.of(new Role("KYC_ANALYST")));
        when(users.findByEmailIgnoreCase("analyst@example.test")).thenReturn(Optional.of(user));
        AuthService service = new AuthService(authentication, users, sessions, audit);

        AuthService.LoginResult result = service.login("analyst@example.test", "fictional-password",
            mock(HttpServletRequest.class));

        assertNotNull(result.token());
        assertEquals(8 * 60 * 60, result.expiresIn());
        verify(sessions).save(any(AuthSession.class));
        verify(audit).recordChange(any(), org.mockito.ArgumentMatchers.eq("LOGIN"),
            org.mockito.ArgumentMatchers.eq("AUTH_SESSION"), any(), org.mockito.ArgumentMatchers.eq("SUCCESS"), any());
    }

    @Test
    void failedLoginReturnsGenericUnauthorizedAndAuditsFailure() {
        AuthenticationManager authentication = mock(AuthenticationManager.class);
        when(authentication.authenticate(any())).thenThrow(new BadCredentialsException("secret detail"));
        UserRepository users = mock(UserRepository.class);
        AuditService audit = mock(AuditService.class);
        AuthService service = new AuthService(authentication, users,
            mock(AuthSessionRepository.class), audit);

        ApiException exception = assertThrows(ApiException.class,
            () -> service.login("missing@example.test", "incorrect-password", mock(HttpServletRequest.class)));

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatus());
        assertEquals("Invalid email or password", exception.getMessage());
        verify(audit).record(org.mockito.ArgumentMatchers.isNull(),
            org.mockito.ArgumentMatchers.eq("LOGIN"), org.mockito.ArgumentMatchers.eq("AUTH_SESSION"),
            org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.eq("FAILURE"), any());
        verify(users, org.mockito.Mockito.never()).findByEmailIgnoreCase(any());
    }
}
