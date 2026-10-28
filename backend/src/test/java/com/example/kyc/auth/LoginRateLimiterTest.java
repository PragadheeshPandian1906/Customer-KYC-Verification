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
}
