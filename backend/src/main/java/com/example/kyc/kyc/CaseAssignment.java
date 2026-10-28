package com.example.kyc.kyc;

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
@Table(name = "case_assignments")
public class CaseAssignment {
    @Id
    @Column(length = 36, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "case_id", nullable = false)
    private KycCase kycCase;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "analyst_user_id", nullable = false)
    private com.example.kyc.user.UserAccount analyst;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assigned_by_user_id", nullable = false)
    private com.example.kyc.user.UserAccount assignedBy;

    @Column(name = "assigned_at", nullable = false, updatable = false)
    private Instant assignedAt = Instant.now();

    @Column(name = "ended_at")
    private Instant endedAt;

    protected CaseAssignment() {
    }

    public CaseAssignment(KycCase kycCase, com.example.kyc.user.UserAccount analyst,
                          com.example.kyc.user.UserAccount assignedBy) {
        this.kycCase = kycCase;
        this.analyst = analyst;
        this.assignedBy = assignedBy;
    }

    public String getId() {
        return id;
    }

    public com.example.kyc.user.UserAccount getAnalyst() {
        return analyst;
    }

    public com.example.kyc.user.UserAccount getAssignedBy() {
        return assignedBy;
    }

    public Instant getAssignedAt() {
        return assignedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public void end() {
        endedAt = Instant.now();
    }
}
