package com.example.kyc.auth;

import com.example.kyc.audit.AuditService;
import com.example.kyc.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class LoginRateLimiter {
    private static final long WINDOW_NANOS = Duration.ofMinutes(15).toNanos();
    private static final long CLEANUP_INTERVAL_NANOS = Duration.ofMinutes(1).toNanos();
    private static final int MAX_ATTEMPTS = 10;
    static final int MAX_TRACKED_CLIENTS = 10_000;
    private static final String OVERFLOW_CLIENT = "\u0000overflow";
    private final Map<String, Window> windows = new LinkedHashMap<>();
    private final AuditService audit;
    private long lastCleanupNanos;

    public LoginRateLimiter(AuditService audit) {
        this.audit = audit;
    }

    public void check(String remoteAddress, HttpServletRequest request) {
        long now = System.nanoTime();
        boolean allowed;
        synchronized (windows) {
            if (lastCleanupNanos == 0 || now - lastCleanupNanos >= CLEANUP_INTERVAL_NANOS) {
                windows.entrySet().removeIf(entry -> now - entry.getValue().startedAt() >= WINDOW_NANOS);
                lastCleanupNanos = now;
            }

            String key = remoteAddress == null ? "unknown" : remoteAddress;
            if (!windows.containsKey(key) && windows.size() >= MAX_TRACKED_CLIENTS - 1) {
                key = OVERFLOW_CLIENT;
            }
            Window current = windows.get(key);
            Window active = current == null || now - current.startedAt() >= WINDOW_NANOS
                ? new Window(now, 0)
                : current;
            allowed = active.attempts() < MAX_ATTEMPTS;
            if (allowed) {
                windows.put(key, new Window(active.startedAt(), active.attempts() + 1));
            }
        }
        if (!allowed) {
            audit.record(null, "LOGIN_RATE_LIMITED", "AUTH_SESSION", null, "DENIED", request);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many login attempts; try again later");
        }
    }

    private record Window(long startedAt, int attempts) {
    }
}
