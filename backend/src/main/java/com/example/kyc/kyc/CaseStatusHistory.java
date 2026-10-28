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
@Table(name = "case_status_history")
public class CaseStatusHistory extends PersistentEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "case_id", nullable = false)
    private KycCase kycCase;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", nullable = false, length = 32)
    private KycEnums.CaseStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 32)
    private KycEnums.CaseStatus toStatus;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "changed_by_user_id", nullable = false)
    private UserAccount changedBy;

    @Column(name = "reason_code", length = 60)
    private String reasonCode;

    protected CaseStatusHistory() {
    }

    public CaseStatusHistory(KycCase kycCase, KycEnums.CaseStatus fromStatus,
                             KycEnums.CaseStatus toStatus, UserAccount changedBy, String reasonCode) {
        this.kycCase = kycCase;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.changedBy = changedBy;
        this.reasonCode = reasonCode;
    }

    public KycCase getKycCase() {
        return kycCase;
    }

    public KycEnums.CaseStatus getFromStatus() {
        return fromStatus;
    }

    public KycEnums.CaseStatus getToStatus() {
        return toStatus;
    }

    public UserAccount getChangedBy() {
        return changedBy;
    }

    public String getReasonCode() {
        return reasonCode;
    }
}
