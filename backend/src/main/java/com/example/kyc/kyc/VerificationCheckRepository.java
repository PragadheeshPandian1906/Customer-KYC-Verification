package com.example.kyc.kyc;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VerificationCheckRepository extends JpaRepository<VerificationCheck, String> {
    List<VerificationCheck> findAllByKycCase_IdOrderByCreatedAtAsc(String caseId);
}
