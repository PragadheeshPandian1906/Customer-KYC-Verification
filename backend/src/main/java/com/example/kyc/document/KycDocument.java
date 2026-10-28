package com.example.kyc.document;

import com.example.kyc.common.PersistentEntity;
import com.example.kyc.kyc.KycCase;
import com.example.kyc.user.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "kyc_documents")
public class KycDocument extends PersistentEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "case_id", nullable = false)
    private KycCase kycCase;

    @Column(name = "document_type", nullable = false, length = 40)
    private String documentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private DocumentStatus status = DocumentStatus.PENDING_REVIEW;

    @Column(name = "current_version", nullable = false)
    private int currentVersion = 1;

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @Column(name = "request_fingerprint", length = 64, columnDefinition = "CHAR(64)")
    private String requestFingerprint;

    @Version
    @Column(nullable = false)
    private long version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private UserAccount createdBy;

    protected KycDocument() {
    }

    public KycDocument(KycCase kycCase, String documentType, String idempotencyKey,
                       String requestFingerprint, UserAccount createdBy) {
        this.kycCase = kycCase;
        this.documentType = documentType;
        this.idempotencyKey = idempotencyKey;
        this.requestFingerprint = requestFingerprint;
        this.createdBy = createdBy;
    }

    public KycCase getKycCase() {
        return kycCase;
    }

    public String getDocumentType() {
        return documentType;
    }

    public DocumentStatus getStatus() {
        return status;
    }

    public int getCurrentVersion() {
        return currentVersion;
    }

    public long getVersion() {
        return version;
    }

    public String getRequestFingerprint() {
        return requestFingerprint;
    }

    public void incrementVersion() {
        currentVersion++;
        status = DocumentStatus.PENDING_REVIEW;
    }

    public void setStatus(DocumentStatus status) {
        this.status = status;
    }
}
