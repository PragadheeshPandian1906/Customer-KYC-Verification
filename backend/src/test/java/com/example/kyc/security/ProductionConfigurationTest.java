package com.example.kyc.security;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProductionConfigurationTest {
    @Test
    void productionIsTheDefaultProfile() throws Exception {
        PropertySource<?> application = new YamlPropertySourceLoader()
            .load("application", new ClassPathResource("application.yml"))
            .get(0);

        assertEquals("prod", application.getProperty("spring.profiles.default"));
    }

    @Test
    void productionRequiresExplicitDatabaseAndStorageConfigurationAndDisablesApiDocs() throws Exception {
        PropertySource<?> production = new YamlPropertySourceLoader()
            .load("production", new ClassPathResource("application-prod.yml"))
            .get(0);

        assertEquals("${DB_URL}", production.getProperty("spring.datasource.url"));
        assertEquals("${DB_USERNAME}", production.getProperty("spring.datasource.username"));
        assertEquals("${DB_PASSWORD}", production.getProperty("spring.datasource.password"));
        assertEquals("${DB_MIGRATION_URL}", production.getProperty("spring.flyway.url"));
        assertEquals("${DB_MIGRATION_USERNAME}", production.getProperty("spring.flyway.user"));
        assertEquals("${DB_MIGRATION_PASSWORD}", production.getProperty("spring.flyway.password"));
        assertEquals(false, production.getProperty("springdoc.api-docs.enabled"));
        assertEquals(false, production.getProperty("springdoc.swagger-ui.enabled"));
        assertEquals(true, production.getProperty("app.security.secure-cookie"));
        assertEquals("${KYC_STORAGE_ROOT}", production.getProperty("app.storage.root"));
        assertEquals("${KYC_STORAGE_KEY}", production.getProperty("app.storage.encryption-key"));
    }
}
