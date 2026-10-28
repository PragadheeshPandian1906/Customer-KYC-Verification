package com.example.kyc.kyc;

import com.example.kyc.common.PersistentEntity;
import com.example.kyc.customer.Customer;
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

import java.util.UUID;

@Entity
@Table(name = "kyc_cases")
public class KycCase extends PersistentEntity {
    @Column(name = "case_reference", nullable = false, unique = true, length = 32)
    private String caseReference;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Enumerated(EnumType.STRING)
    @Column(name = "case_type", nullable = false, length = 24)
    private KycEnums.CaseType caseType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private KycEnums.CaseStatus status = KycEnums.CaseStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", nullable = false, length = 16)
    private KycEnums.RiskLevel riskLevel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private KycEnums.Priority priority;

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private UserAccount createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to_user_id")
    private UserAccount assignedTo;

    @Version
    @Column(nullable = false)
    private long version;

    protected KycCase() {
    }

    public KycCase(Customer customer, KycEnums.CaseType caseType, KycEnums.RiskLevel riskLevel,
                   KycEnums.Priority priority, String idempotencyKey, UserAccount createdBy) {
        this.caseReference = "KYC-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
        this.customer = customer;
        this.caseType = caseType;
        this.riskLevel = riskLevel;
        this.priority = priority;
        this.idempotencyKey = idempotencyKey;
        this.createdBy = createdBy;
    }

    public Customer getCustomer() {
        return customer;
    }

    public UserAccount getAssignedTo() {
        return assignedTo;
    }

    public String getCaseReference() {
        return caseReference;
    }

    public KycEnums.CaseType getCaseType() {
        return caseType;
    }

    public KycEnums.CaseStatus getStatus() {
        return status;
    }

    public KycEnums.RiskLevel getRiskLevel() {
        return riskLevel;
    }

    public KycEnums.Priority getPriority() {
        return priority;
    }

    public long getVersion() {
        return version;
    }

    public void update(KycEnums.RiskLevel riskLevel, KycEnums.Priority priority) {
        if (riskLevel != null) {
            this.riskLevel = riskLevel;
        }
        if (priority != null) {
            this.priority = priority;
        }
    }

    void transitionFromWorkflow(KycEnums.CaseStatus next) {
        boolean allowed = switch (status) {
            case DRAFT, NEEDS_INFORMATION -> next == KycEnums.CaseStatus.IN_REVIEW;
            case IN_REVIEW -> next == KycEnums.CaseStatus.PENDING_SUPERVISOR_APPROVAL
                || next == KycEnums.CaseStatus.APPROVED
                || next == KycEnums.CaseStatus.REJECTED
                || next == KycEnums.CaseStatus.NEEDS_INFORMATION;
            case PENDING_SUPERVISOR_APPROVAL -> next == KycEnums.CaseStatus.APPROVED
                || next == KycEnums.CaseStatus.REJECTED
                || next == KycEnums.CaseStatus.IN_REVIEW;
            case APPROVED, REJECTED -> next == KycEnums.CaseStatus.CLOSED;
            case CLOSED -> false;
        };
        if (!allowed) {
            throw new IllegalStateException("Invalid KYC case workflow transition");
        }
        status = next;
    }

    public void assign(UserAccount assignee) {
        assignedTo = assignee;
    }
}
