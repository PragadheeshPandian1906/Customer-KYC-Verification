package com.example.kyc.document;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EncryptedLocalDocumentStorageTest {
    @TempDir
    Path tempDir;

    @Test
    void encryptsContentAtRestAndReadsItBack() throws Exception {
        byte[] key = new byte[32];
        java.security.SecureRandom.getInstanceStrong().nextBytes(key);
        EncryptedLocalDocumentStorage storage = new EncryptedLocalDocumentStorage(
            tempDir.toString(), Base64.getEncoder().encodeToString(key));
        storage.initialize();
        String storageKey = UUID.randomUUID().toString();
        byte[] content = "%PDF-1.7 fictional test document".getBytes();

        storage.write(storageKey, content);

        Path persisted = tempDir.resolve(storageKey + ".bin");
        assertFalse(java.util.Arrays.equals(content, Files.readAllBytes(persisted)));
        assertArrayEquals(content, storage.read(storageKey));
        storage.delete(storageKey);
        assertFalse(Files.exists(persisted));
    }

    @Test
    void rejectsPathTraversalStorageKeys() throws Exception {
        byte[] key = new byte[32];
        EncryptedLocalDocumentStorage storage = new EncryptedLocalDocumentStorage(
            tempDir.toString(), Base64.getEncoder().encodeToString(key));
        storage.initialize();

        assertThrows(java.io.IOException.class, () -> storage.read(".."));
    }

    @Test
    void requiresAnExactAes256Key() {
        EncryptedLocalDocumentStorage storage = new EncryptedLocalDocumentStorage(
            tempDir.toString(), Base64.getEncoder().encodeToString(new byte[16]));

        assertThrows(IllegalStateException.class, storage::initialize);
    }
}
