package com.example.kyc.document;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;

public interface DocumentStorage {
    void write(String storageKey, byte[] content) throws IOException;

    byte[] read(String storageKey) throws IOException;

    void delete(String storageKey) throws IOException;

    Set<String> listKeysBefore(Instant cutoff) throws IOException;
}
