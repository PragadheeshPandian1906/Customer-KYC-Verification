package com.example.kyc.kyc;

import com.example.kyc.common.PersistentEntity;
import com.example.kyc.document.KycDocument;
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
@Table(name = "verification_checks")
public class VerificationCheck extends PersistentEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "case_id", nullable = false)
    private KycCase kycCase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id")
    private KycDocument document;

    @Column(name = "check_type", nullable = false, length = 60)
    private String checkType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private VerificationEnums.CheckResult result;

    @Column(length = 500)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "performed_by_user_id", nullable = false)
    private UserAccount performedBy;

    protected VerificationCheck() {
    }

    public VerificationCheck(KycCase kycCase, KycDocument document, String checkType,
                             VerificationEnums.CheckResult result, String notes, UserAccount performedBy) {
        this.kycCase = kycCase;
        this.document = document;
        this.checkType = checkType;
        this.result = result;
        this.notes = notes;
        this.performedBy = performedBy;
    }

    public KycCase getKycCase() {
        return kycCase;
    }

    public KycDocument getDocument() {
        return document;
    }

    public String getCheckType() {
        return checkType;
    }

    public VerificationEnums.CheckResult getResult() {
        return result;
    }

    public String getNotes() {
        return notes;
    }

    public UserAccount getPerformedBy() {
        return performedBy;
    }
}
