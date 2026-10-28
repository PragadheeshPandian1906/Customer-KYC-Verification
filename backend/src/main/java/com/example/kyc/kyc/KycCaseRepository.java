package com.example.kyc.kyc;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface KycCaseRepository extends JpaRepository<KycCase, String> {
    Optional<KycCase> findByCreatedBy_IdAndIdempotencyKey(String creatorId, String idempotencyKey);

    Page<KycCase> findAllByCustomer_Owner_Id(String ownerId, Pageable pageable);

    Page<KycCase> findAllByCustomer_Id(String customerId, Pageable pageable);

    Page<KycCase> findAllByCustomer_IdAndAssignedTo_Id(String customerId, String assignedToId, Pageable pageable);

    Page<KycCase> findAllByAssignedTo_Id(String assignedToId, Pageable pageable);

    List<KycCase> findAllByCustomer_IdOrderByCreatedAtDesc(String customerId);

    List<KycCase> findAllByStatusOrderByCreatedAtAsc(KycEnums.CaseStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select kycCase from KycCase kycCase where kycCase.id = :caseId")
    Optional<KycCase> lockById(@Param("caseId") String caseId);
}
