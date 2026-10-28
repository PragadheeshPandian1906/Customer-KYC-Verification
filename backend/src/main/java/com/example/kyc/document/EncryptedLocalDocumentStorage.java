package com.example.kyc.document;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.DirectoryStream;
import java.nio.file.attribute.FileTime;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;
import java.util.HashSet;
import java.util.Set;
import java.time.Instant;

@Component
public class EncryptedLocalDocumentStorage implements DocumentStorage {
    private static final int NONCE_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;
    private final Path configuredRoot;
    private final String base64Key;
    private final SecureRandom secureRandom = new SecureRandom();
    private Path root;
    private SecretKeySpec key;

    public EncryptedLocalDocumentStorage(
        @Value("${app.storage.root:${user.home}/.secure-customer-kyc-api/documents}") String root,
        @Value("${app.storage.encryption-key:}") String base64Key) {
        this.configuredRoot = Path.of(root).toAbsolutePath().normalize();
        this.base64Key = base64Key;
    }

    @PostConstruct
    void initialize() {
        try {
            byte[] decoded = Base64.getDecoder().decode(base64Key);
            if (decoded.length != 32) {
                throw new IllegalStateException("KYC_STORAGE_KEY must be a Base64-encoded 32-byte AES key");
            }
            key = new SecretKeySpec(decoded, "AES");
            Files.createDirectories(configuredRoot);
            root = configuredRoot.toRealPath();
            Path workingDirectory = Path.of(System.getProperty("user.dir")).toRealPath();
            if (root.startsWith(workingDirectory)) {
                throw new IllegalStateException("Document storage must be outside the application directory");
            }
            Arrays.fill(decoded, (byte) 0);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("KYC_STORAGE_KEY must be a Base64-encoded 32-byte AES key", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot initialize protected document storage", exception);
        }
    }

    @Override
    public void write(String storageKey, byte[] content) throws IOException {
        Path target = resolve(storageKey);
        byte[] nonce = new byte[NONCE_LENGTH];
        secureRandom.nextBytes(nonce);
        byte[] encrypted;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, nonce));
            encrypted = cipher.doFinal(content);
        } catch (GeneralSecurityException exception) {
            throw new IOException("Unable to encrypt document content", exception);
        }

        Path temp = root.resolve(UUID.randomUUID() + ".tmp");
        try {
            byte[] fileContent = new byte[nonce.length + encrypted.length];
            System.arraycopy(nonce, 0, fileContent, 0, nonce.length);
            System.arraycopy(encrypted, 0, fileContent, nonce.length, encrypted.length);
            Files.write(temp, fileContent);
            try {
                Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException exception) {
                Files.move(temp, target);
            }
            Arrays.fill(fileContent, (byte) 0);
            Arrays.fill(encrypted, (byte) 0);
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    @Override
    public byte[] read(String storageKey) throws IOException {
        byte[] fileContent = Files.readAllBytes(resolve(storageKey));
        if (fileContent.length <= NONCE_LENGTH) {
            throw new IOException("Stored document is invalid");
        }
        byte[] nonce = Arrays.copyOfRange(fileContent, 0, NONCE_LENGTH);
        byte[] encrypted = Arrays.copyOfRange(fileContent, NONCE_LENGTH, fileContent.length);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, nonce));
            return cipher.doFinal(encrypted);
        } catch (GeneralSecurityException exception) {
            throw new IOException("Stored document failed integrity verification", exception);
        } finally {
            Arrays.fill(fileContent, (byte) 0);
            Arrays.fill(encrypted, (byte) 0);
        }
    }

    @Override
    public void delete(String storageKey) throws IOException {
        Files.deleteIfExists(resolve(storageKey));
    }

    @Override
    public Set<String> listKeysBefore(Instant cutoff) throws IOException {
        Set<String> keys = new HashSet<>();
        try (DirectoryStream<Path> files = Files.newDirectoryStream(root, "*.bin")) {
            for (Path file : files) {
                FileTime modifiedAt = Files.getLastModifiedTime(file);
                if (Files.isRegularFile(file) && !Files.isSymbolicLink(file)
                    && modifiedAt.toInstant().isBefore(cutoff)) {
                    String filename = file.getFileName().toString();
                    keys.add(filename.substring(0, filename.length() - 4));
                }
            }
        }
        return Set.copyOf(keys);
    }

    private Path resolve(String storageKey) throws IOException {
        try {
            UUID.fromString(storageKey);
        } catch (IllegalArgumentException exception) {
            throw new IOException("Invalid internal storage key", exception);
        }
        Path candidate = root.resolve(storageKey + ".bin").normalize();
        if (!candidate.getParent().equals(root) || Files.isSymbolicLink(candidate)) {
            throw new IOException("Invalid internal storage location");
        }
        return candidate;
    }
}
