package com.example.kyc.kyc;

import com.example.kyc.common.PersistentEntity;
import com.example.kyc.user.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "verification_decisions")
public class VerificationDecision extends PersistentEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "case_id", nullable = false)
    private KycCase kycCase;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submitted_by_user_id", nullable = false)
    private UserAccount submittedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private VerificationEnums.DecisionOutcome outcome;

    @Column(name = "reason_code", nullable = false, length = 60)
    private String reasonCode;

    @Column(length = 1000)
    private String rationale;

    @Column(name = "approval_required", nullable = false)
    private boolean approvalRequired;

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @Column(name = "request_fingerprint", length = 64, columnDefinition = "CHAR(64)")
    private String requestFingerprint;

    protected VerificationDecision() {
    }

    public VerificationDecision(KycCase kycCase, UserAccount submittedBy,
                                VerificationEnums.DecisionOutcome outcome, String reasonCode,
                                String rationale, boolean approvalRequired, String idempotencyKey,
                                String requestFingerprint) {
        this.kycCase = kycCase;
        this.submittedBy = submittedBy;
        this.outcome = outcome;
        this.reasonCode = reasonCode;
        this.rationale = rationale;
        this.approvalRequired = approvalRequired;
        this.idempotencyKey = idempotencyKey;
        this.requestFingerprint = requestFingerprint;
    }

    public KycCase getKycCase() {
        return kycCase;
    }

    public UserAccount getSubmittedBy() {
        return submittedBy;
    }

    public VerificationEnums.DecisionOutcome getOutcome() {
        return outcome;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public String getRationale() {
        return rationale;
    }

    public boolean isApprovalRequired() {
        return approvalRequired;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public String getRequestFingerprint() {
        return requestFingerprint;
    }
}
