package com.example.kyc.auth;

import com.example.kyc.user.UserAccount;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

@Component
public class SessionAuthenticationFilter extends OncePerRequestFilter {
    public static final String COOKIE_NAME = "KYC_SESSION";
    private final AuthSessionRepository sessions;

    public SessionAuthenticationFilter(AuthSessionRepository sessions) {
        this.sessions = sessions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        findToken(request).flatMap(this::findSession).ifPresent(session -> {
            UserAccount user = session.getUser();
            if (user.isEnabled()) {
                var authorities = user.getRoles().stream()
                    .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getRoleCode()))
                    .toList();
                var authentication = new UsernamePasswordAuthenticationToken(user, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        });
        filterChain.doFilter(request, response);
    }

    public static Optional<String> findToken(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }
        for (Cookie cookie : request.getCookies()) {
            if (COOKIE_NAME.equals(cookie.getName()) && cookie.getValue() != null
                && cookie.getValue().length() <= 128) {
                return Optional.of(cookie.getValue());
            }
        }
        return Optional.empty();
    }

    static String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the Java runtime", exception);
        }
    }

    private Optional<AuthSession> findSession(String token) {
        return sessions.findByTokenHashAndRevokedAtIsNullAndExpiresAtAfter(hashToken(token), Instant.now());
    }
}
