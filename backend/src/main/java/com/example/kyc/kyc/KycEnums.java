package com.example.kyc.kyc;

public final class KycEnums {
    private KycEnums() {
    }

    public enum CaseType {
        INDIVIDUAL, BUSINESS
    }

    public enum CaseStatus {
        DRAFT, IN_REVIEW, PENDING_SUPERVISOR_APPROVAL, APPROVED, REJECTED, NEEDS_INFORMATION, CLOSED
    }

    public enum RiskLevel {
        LOW, MEDIUM, HIGH
    }

    public enum Priority {
        LOW, NORMAL, HIGH
    }
}
