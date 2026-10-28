package com.example.kyc.auth;

import com.example.kyc.audit.AuditService;
import com.example.kyc.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class LoginRateLimiterTest {
    @Test
    void blocksTheEleventhAttemptWithinWindow() {
        LoginRateLimiter limiter = new LoginRateLimiter(mock(AuditService.class));
        MockHttpServletRequest request = new MockHttpServletRequest();

        for (int attempt = 0; attempt < 10; attempt++) {
            limiter.check("192.0.2.10", request);
        }

        ApiException exception = assertThrows(ApiException.class, () -> limiter.check("192.0.2.10", request));
        assertEquals(429, exception.getStatus().value());
    }

    @Test
    void boundsTrackedClientsAndRateLimitsOverflowClientsTogether() {
        LoginRateLimiter limiter = new LoginRateLimiter(mock(AuditService.class));
        MockHttpServletRequest request = new MockHttpServletRequest();

        for (int client = 0; client < LoginRateLimiter.MAX_TRACKED_CLIENTS - 1; client++) {
            limiter.check("client-" + client, request);
        }
        for (int attempt = 0; attempt < 10; attempt++) {
            limiter.check("overflow-client-" + attempt, request);
        }

        ApiException exception = assertThrows(ApiException.class,
            () -> limiter.check("next-overflow-client", request));
        assertEquals(429, exception.getStatus().value());
    }
}
