package com.example.kyc.kyc;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CaseAssignmentRepository extends JpaRepository<CaseAssignment, String> {
    Optional<CaseAssignment> findFirstByKycCase_IdAndEndedAtIsNullOrderByAssignedAtDesc(String caseId);

    List<CaseAssignment> findAllByKycCase_IdOrderByAssignedAtDesc(String caseId);
}
