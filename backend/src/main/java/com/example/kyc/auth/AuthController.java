package com.example.kyc.auth;

import com.example.kyc.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService authService;
    private final LoginRateLimiter rateLimiter;
    private final boolean secureCookie;

    public AuthController(AuthService authService, LoginRateLimiter rateLimiter,
                          @Value("${app.security.secure-cookie:false}") boolean secureCookie) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.secureCookie = secureCookie;
    }

    @GetMapping("/csrf")
    @SecurityRequirements
    public CsrfResponse csrf(CsrfToken csrfToken) {
        return new CsrfResponse(csrfToken.getHeaderName(), csrfToken.getToken());
    }

    @PostMapping("/login")
    @SecurityRequirements
    public ResponseEntity<UserResponse> login(@Valid @RequestBody LoginRequest request,
                                               HttpServletRequest httpRequest) {
        rateLimiter.check(httpRequest.getRemoteAddr(), httpRequest);
        AuthService.LoginResult result = authService.login(request.email(), request.password(), httpRequest);
        ResponseCookie cookie = sessionCookie(result.token(), Duration.ofSeconds(result.expiresIn()));
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString())
            .body(toUserResponse(result.user()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal UserAccount user,
                                       HttpServletRequest request) {
        String token = SessionAuthenticationFilter.findToken(request).orElse(null);
        authService.logout(token, user, request);
        return ResponseEntity.noContent()
            .header(HttpHeaders.SET_COOKIE, sessionCookie("", Duration.ZERO).toString())
            .build();
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal UserAccount user) {
        return toUserResponse(user);
    }

    private ResponseCookie sessionCookie(String value, Duration maxAge) {
        return ResponseCookie.from(SessionAuthenticationFilter.COOKIE_NAME, value)
            .httpOnly(true)
            .secure(secureCookie)
            .sameSite("Strict")
            .path("/")
            .maxAge(maxAge)
            .build();
    }

    private UserResponse toUserResponse(UserAccount user) {
        List<String> roles = user.getRoles().stream().map(role -> role.getRoleCode()).sorted().toList();
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), roles);
    }

    public record LoginRequest(@NotBlank @Email @Size(max = 254) String email,
                               @NotBlank @Size(min = 12, max = 128) String password) {
    }

    public record CsrfResponse(String headerName, String token) {
    }

    public record UserResponse(String id, String email, String displayName, List<String> roles) {
    }
}
