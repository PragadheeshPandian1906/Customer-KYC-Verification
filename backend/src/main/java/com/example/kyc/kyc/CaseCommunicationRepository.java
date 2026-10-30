package com.example.kyc.kyc;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CaseCommunicationRepository extends JpaRepository<CaseCommunication, String> {
    List<CaseCommunication> findAllByKycCase_IdOrderByCreatedAtAsc(String caseId);

    Optional<CaseCommunication> findByIdAndKycCase_Id(String id, String caseId);

    boolean existsByParent_Id(String parentId);
}
