package com.example.kyc.kyc;

import com.example.kyc.audit.AuditService;
import com.example.kyc.common.ApiException;
import com.example.kyc.document.KycDocument;
import com.example.kyc.document.KycDocumentRepository;
import com.example.kyc.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class CaseCommunicationService {
    private final CaseCommunicationRepository communications;
    private final KycDocumentRepository documents;
    private final KycCaseService cases;
    private final AuditService audit;

    public CaseCommunicationService(CaseCommunicationRepository communications,
                                    KycDocumentRepository documents, KycCaseService cases,
                                    AuditService audit) {
        this.communications = communications;
        this.documents = documents;
        this.cases = cases;
        this.audit = audit;
    }

    @Transactional
    public void recordInformationRequest(KycCase kycCase, VerificationDecision decision,
                                         UserAccount actor, HttpServletRequest http) {
        communications.save(CaseCommunication.informationRequest(
            kycCase, actor, decision, decision.getRationale().trim()));
        audit.recordChange(actor, "KYC_INFORMATION_REQUESTED", "KYC_CASE",
            kycCase.getId(), "SUCCESS", http);
    }

    @Transactional(readOnly = true)
    public List<CommunicationResponse> list(String caseId, UserAccount actor, HttpServletRequest http) {
        cases.authorizedCase(caseId, actor, http, "KYC_COMMUNICATION_LIST");
        return communications.findAllByKycCase_IdOrderByCreatedAtAsc(caseId).stream()
            .map(CommunicationResponse::from).toList();
    }

    @Transactional
    public CommunicationResponse respond(String caseId, CustomerResponseRequest request,
                                         UserAccount actor, HttpServletRequest http) {
        KycCase kycCase = cases.lockAuthorizedCase(caseId, actor, http, "KYC_CUSTOMER_RESPONSE");
        if (!actor.hasRole("CUSTOMER")) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only the case customer can respond");
        }
        if (kycCase.getStatus() != KycEnums.CaseStatus.NEEDS_INFORMATION) {
            throw new ApiException(HttpStatus.CONFLICT,
                "The case is not currently waiting for customer information");
        }
        CaseCommunication unanswered = communications.findByIdAndKycCase_Id(request.requestId(), caseId)
            .filter(communication ->
                communication.getType() == CaseCommunication.CommunicationType.INFORMATION_REQUEST)
            .filter(communication -> !communications.existsByParent_Id(communication.getId()))
            .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                "The referenced information request is unavailable or already answered"));
        List<String> documentIds = request.documentIds() == null ? List.of() : request.documentIds();
        Set<String> uniqueIds = new HashSet<>(documentIds);
        if (uniqueIds.size() != documentIds.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Document references must be unique");
        }
        List<KycDocument> linkedDocuments = documents.findAllById(uniqueIds);
        if (linkedDocuments.size() != uniqueIds.size()
            || linkedDocuments.stream().anyMatch(document ->
                !document.getKycCase().getId().equals(caseId))) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                "Every referenced document must belong to this KYC case");
        }
        CaseCommunication response;
        try {
            response = communications.saveAndFlush(
                CaseCommunication.customerResponse(kycCase, actor, unanswered, request.message(),
                    new HashSet<>(linkedDocuments)));
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(HttpStatus.CONFLICT,
                "The referenced information request has already been answered");
        }
        audit.recordChange(actor, "KYC_CUSTOMER_INFORMATION_PROVIDED",
            "KYC_CASE", caseId, "SUCCESS", http);
        return CommunicationResponse.from(response);
    }

    public record CustomerResponseRequest(
        @NotBlank @Size(max = 36) String requestId,
        @NotBlank @Size(max = 2000) String message,
        @Size(max = 20) List<@NotBlank @Size(max = 36) String> documentIds) {
    }

    public record DocumentReference(String id, String documentType) {
        static DocumentReference from(KycDocument document) {
            return new DocumentReference(document.getId(), document.getDocumentType());
        }
    }

    public record CommunicationResponse(String id, String type, String senderRole,
                                        String senderDisplayName, String message,
                                        String parentCommunicationId, String sourceDecisionId,
                                        List<DocumentReference> documents,
                                        java.time.Instant createdAt) {
        static CommunicationResponse from(CaseCommunication communication) {
            return new CommunicationResponse(communication.getId(), communication.getType().name(),
                communication.getSenderRole(), communication.getSender().getDisplayName(),
                communication.getMessage(),
                communication.getParent() == null ? null : communication.getParent().getId(),
                communication.getSourceDecision() == null
                    ? null : communication.getSourceDecision().getId(),
                communication.getDocuments().stream().map(DocumentReference::from).toList(),
                communication.getCreatedAt());
        }
    }
}
