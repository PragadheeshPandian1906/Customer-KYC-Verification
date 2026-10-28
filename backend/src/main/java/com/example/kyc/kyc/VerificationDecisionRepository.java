package com.example.kyc.kyc;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface VerificationDecisionRepository extends JpaRepository<VerificationDecision, String> {
    List<VerificationDecision> findAllByKycCase_IdOrderByCreatedAtDesc(String caseId);

    Optional<VerificationDecision> findByKycCase_IdAndSubmittedBy_IdAndIdempotencyKey(
        String caseId, String submittedById, String idempotencyKey);

    List<VerificationDecision> findAllByKycCase_IdAndApprovalRequiredTrueOrderByCreatedAtAsc(String caseId);
}
