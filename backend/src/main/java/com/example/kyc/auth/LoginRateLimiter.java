package com.example.kyc.auth;

import com.example.kyc.audit.AuditService;
import com.example.kyc.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
public class LoginRateLimiter {
    private static final long WINDOW_NANOS = Duration.ofMinutes(15).toNanos();
    private static final int MAX_ATTEMPTS = 10;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AuditService audit;

    public LoginRateLimiter(AuditService audit) {
        this.audit = audit;
    }

    public void check(String remoteAddress, HttpServletRequest request) {
        String key = remoteAddress == null ? "unknown" : remoteAddress;
        long now = System.nanoTime();
        AtomicBoolean allowed = new AtomicBoolean();
        windows.compute(key, (ignored, current) -> {
            Window active = current == null || now - current.startedAt() >= WINDOW_NANOS
                ? new Window(now, 0)
                : current;
            if (active.attempts() < MAX_ATTEMPTS) {
                allowed.set(true);
                return new Window(active.startedAt(), active.attempts() + 1);
            }
            return active;
        });
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(entry -> now - entry.getValue().startedAt() >= WINDOW_NANOS);
        }
        if (!allowed.get()) {
            audit.record(null, "LOGIN_RATE_LIMITED", "AUTH_SESSION", null, "DENIED", request);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many login attempts; try again later");
        }
    }

    private record Window(long startedAt, int attempts) {
    }
}
