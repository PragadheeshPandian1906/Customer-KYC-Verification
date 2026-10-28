package com.example.kyc.auth;

import com.example.kyc.audit.AuditService;
import com.example.kyc.common.ApiException;
import com.example.kyc.user.UserAccount;
import com.example.kyc.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

@Service
public class AuthService {
    private static final Duration SESSION_TTL = Duration.ofHours(8);
    private final AuthenticationManager authenticationManager;
    private final UserRepository users;
    private final AuthSessionRepository sessions;
    private final AuditService audit;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthService(AuthenticationManager authenticationManager, UserRepository users,
                       AuthSessionRepository sessions, AuditService audit) {
        this.authenticationManager = authenticationManager;
        this.users = users;
        this.sessions = sessions;
        this.audit = audit;
    }

    @Transactional
    public LoginResult login(String email, String password, HttpServletRequest request) {
        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, password));
        } catch (AuthenticationException exception) {
            audit.record(null, "LOGIN", "AUTH_SESSION", null, "FAILURE", request);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        UserAccount user = users.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        byte[] tokenBytes = new byte[32];
        secureRandom.nextBytes(tokenBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        sessions.save(new AuthSession(user, SessionAuthenticationFilter.hashToken(rawToken),
            Instant.now().plus(SESSION_TTL)));
        audit.recordChange(user, "LOGIN", "AUTH_SESSION", null, "SUCCESS", request);
        return new LoginResult(rawToken, SESSION_TTL.toSeconds(), user);
    }

    @Transactional
    public void logout(String rawToken, UserAccount user, HttpServletRequest request) {
        if (rawToken != null) {
            sessions.findByTokenHashAndRevokedAtIsNullAndExpiresAtAfter(
                SessionAuthenticationFilter.hashToken(rawToken), Instant.now())
                .ifPresent(AuthSession::revoke);
        }
        audit.recordChange(user, "LOGOUT", "AUTH_SESSION", null, "SUCCESS", request);
    }

    public record LoginResult(String token, long expiresIn, UserAccount user) {
    }
}
