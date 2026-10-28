package com.example.kyc;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@ActiveProfiles("test")
class KycApplicationContextTest {
    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void applicationContextStartsWithAnIsolatedJpaTestDatabase() {
        assertNotNull(applicationContext.getBean(KycApiApplication.class));
        assertNotNull(applicationContext.getBean("securityFilterChain"));
    }
}
