package com.example.kyc.kyc;

import com.example.kyc.customer.Customer;
import com.example.kyc.user.UserAccount;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class KycCaseWorkflowTest {
    @Test
    void highRiskCaseRequiresSupervisorApprovalBeforeDecision() {
        KycCase kycCase = createCase(KycEnums.RiskLevel.HIGH);

        kycCase.transitionFromWorkflow(KycEnums.CaseStatus.IN_REVIEW);
        assertThrows(IllegalStateException.class, () -> kycCase.transitionFromWorkflow(KycEnums.CaseStatus.CLOSED));
        kycCase.transitionFromWorkflow(KycEnums.CaseStatus.PENDING_SUPERVISOR_APPROVAL);
        kycCase.transitionFromWorkflow(KycEnums.CaseStatus.APPROVED);

        assertEquals(KycEnums.CaseStatus.APPROVED, kycCase.getStatus());
    }

    @Test
    void completedCaseCannotReturnToReview() {
        KycCase kycCase = createCase(KycEnums.RiskLevel.LOW);
        kycCase.transitionFromWorkflow(KycEnums.CaseStatus.IN_REVIEW);
        kycCase.transitionFromWorkflow(KycEnums.CaseStatus.REJECTED);

        assertThrows(IllegalStateException.class,
            () -> kycCase.transitionFromWorkflow(KycEnums.CaseStatus.IN_REVIEW));
    }

    private KycCase createCase(KycEnums.RiskLevel risk) {
        var customer = new Customer(null, "Fictional Customer", "customer@example.test");
        var creator = new UserAccount("analyst@example.test", "hash", "Fictional Analyst", Set.of());
        return new KycCase(customer, KycEnums.CaseType.INDIVIDUAL, risk,
            KycEnums.Priority.NORMAL, null, creator);
    }
}
