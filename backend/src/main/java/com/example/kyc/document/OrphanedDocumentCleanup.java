package com.example.kyc.document;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Component
public class OrphanedDocumentCleanup implements ApplicationRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(OrphanedDocumentCleanup.class);
    private final DocumentStorage storage;
    private final DocumentVersionRepository versions;

    public OrphanedDocumentCleanup(DocumentStorage storage, DocumentVersionRepository versions) {
        this.storage = storage;
        this.versions = versions;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        Set<String> referenced = new HashSet<>(versions.findAllStorageKeys());
        int removed = 0;
        for (String key : storage.listKeysBefore(Instant.now().minus(Duration.ofHours(24)))) {
            if (!referenced.contains(key)) {
                storage.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            LOGGER.info("Removed {} orphaned encrypted document objects", removed);
        }
    }
}
