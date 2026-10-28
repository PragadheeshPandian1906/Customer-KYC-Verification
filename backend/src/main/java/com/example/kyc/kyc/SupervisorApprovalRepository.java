package com.example.kyc.kyc;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface SupervisorApprovalRepository extends JpaRepository<SupervisorApproval, String> {
    Optional<SupervisorApproval> findByDecision_Id(String decisionId);

    List<SupervisorApproval> findAllByDecision_KycCase_Id(String caseId);
}
