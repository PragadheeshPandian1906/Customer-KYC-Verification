package com.example.kyc.document;

import com.example.kyc.user.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_versions")
public class DocumentVersion {
    @Id
    @Column(length = 36, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false)
    private KycDocument document;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @Column(name = "request_fingerprint", length = 64, columnDefinition = "CHAR(64)")
    private String requestFingerprint;

    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(nullable = false, length = 64, columnDefinition = "CHAR(64)")
    private String sha256;

    @Column(name = "storage_key", nullable = false, unique = true, length = 36, columnDefinition = "CHAR(36)")
    private String storageKey;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uploaded_by_user_id", nullable = false)
    private UserAccount uploadedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected DocumentVersion() {
    }

    public DocumentVersion(KycDocument document, int versionNumber, String idempotencyKey,
                           String requestFingerprint, String originalFilename, String contentType,
                           long fileSize, String sha256, String storageKey, UserAccount uploadedBy) {
        this.document = document;
        this.versionNumber = versionNumber;
        this.idempotencyKey = idempotencyKey;
        this.requestFingerprint = requestFingerprint;
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.sha256 = sha256;
        this.storageKey = storageKey;
        this.uploadedBy = uploadedBy;
    }

    public String getId() {
        return id;
    }

    public int getVersionNumber() {
        return versionNumber;
    }

    public KycDocument getDocument() {
        return document;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public String getContentType() {
        return contentType;
    }

    public long getFileSize() {
        return fileSize;
    }

    public String getSha256() {
        return sha256;
    }

    public String getRequestFingerprint() {
        return requestFingerprint;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
