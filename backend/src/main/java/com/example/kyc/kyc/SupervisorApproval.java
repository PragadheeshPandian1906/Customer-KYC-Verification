package com.example.kyc.kyc;

import com.example.kyc.common.PersistentEntity;
import com.example.kyc.user.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "supervisor_approvals")
public class SupervisorApproval extends PersistentEntity {
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "decision_id", nullable = false, unique = true)
    private VerificationDecision decision;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reviewed_by_user_id", nullable = false)
    private UserAccount reviewedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private VerificationEnums.ApprovalOutcome outcome;

    @Column(length = 1000)
    private String reason;

    protected SupervisorApproval() {
    }

    public SupervisorApproval(VerificationDecision decision, UserAccount reviewedBy,
                              VerificationEnums.ApprovalOutcome outcome, String reason) {
        this.decision = decision;
        this.reviewedBy = reviewedBy;
        this.outcome = outcome;
        this.reason = reason;
    }

    public VerificationDecision getDecision() {
        return decision;
    }

    public UserAccount getReviewedBy() {
        return reviewedBy;
    }

    public VerificationEnums.ApprovalOutcome getOutcome() {
        return outcome;
    }

    public String getReason() {
        return reason;
    }
}
