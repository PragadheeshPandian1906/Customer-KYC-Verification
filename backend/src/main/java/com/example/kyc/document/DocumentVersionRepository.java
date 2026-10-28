package com.example.kyc.document;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, String> {
    List<DocumentVersion> findAllByDocument_IdOrderByVersionNumberDesc(String documentId);

    Optional<DocumentVersion> findByDocument_IdAndVersionNumber(String documentId, int versionNumber);

    Optional<DocumentVersion> findByDocument_IdAndIdempotencyKey(String documentId, String idempotencyKey);

    @Query("select documentVersion.storageKey from DocumentVersion documentVersion")
    List<String> findAllStorageKeys();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select document from KycDocument document where document.id = :documentId and document.kycCase.id = :caseId")
    Optional<KycDocument> lockDocument(@Param("caseId") String caseId, @Param("documentId") String documentId);
}
