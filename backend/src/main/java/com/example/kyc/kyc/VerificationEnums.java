package com.example.kyc.kyc;

public final class VerificationEnums {
    private VerificationEnums() {
    }

    public enum CheckResult {
        PASS, FAIL, NEEDS_INFORMATION, NOT_APPLICABLE
    }

    public enum DecisionOutcome {
        APPROVE, REJECT, NEEDS_INFORMATION
    }

    public enum ApprovalOutcome {
        APPROVED, REJECTED
    }
}
