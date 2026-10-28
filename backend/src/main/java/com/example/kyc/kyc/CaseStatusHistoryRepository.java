package com.example.kyc.kyc;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CaseStatusHistoryRepository extends JpaRepository<CaseStatusHistory, String> {
    List<CaseStatusHistory> findAllByKycCase_IdOrderByCreatedAtAsc(String caseId);
}
