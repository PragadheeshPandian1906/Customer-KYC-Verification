package com.example.kyc.document;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface KycDocumentRepository extends JpaRepository<KycDocument, String> {
    List<KycDocument> findAllByKycCase_IdOrderByCreatedAtDesc(String caseId);

    Optional<KycDocument> findByIdAndKycCase_Id(String id, String caseId);

    Optional<KycDocument> findByKycCase_IdAndIdempotencyKey(String caseId, String idempotencyKey);
}
