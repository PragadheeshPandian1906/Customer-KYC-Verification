package com.example.kyc.kyc;

import com.example.kyc.audit.AuditService;
import com.example.kyc.common.ApiException;
import com.example.kyc.document.DocumentStatus;
import com.example.kyc.document.KycDocument;
import com.example.kyc.document.KycDocumentRepository;
import com.example.kyc.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class VerificationWorkflowService {
    private final KycCaseRepository cases;
    private final VerificationCheckRepository checks;
    private final VerificationDecisionRepository decisions;
    private final SupervisorApprovalRepository approvals;
    private final CaseStatusHistoryRepository statusHistory;
    private final CaseCommunicationService communications;
    private final KycDocumentRepository documents;
    private final KycCaseService caseService;
    private final AuditService audit;
    private final Set<String> supportedCheckTypes;
    private final List<String> requiredCheckTypes;
    private final List<String> requiredDocumentTypes;

    public VerificationWorkflowService(
        KycCaseRepository cases,
        VerificationCheckRepository checks,
        VerificationDecisionRepository decisions,
        SupervisorApprovalRepository approvals,
        CaseStatusHistoryRepository statusHistory,
        CaseCommunicationService communications,
        KycDocumentRepository documents,
        KycCaseService caseService,
        AuditService audit,
        @Value("${app.kyc.verification-check-types:CUSTOMER_INFORMATION,IDENTITY_DOCUMENT,ADDRESS_DOCUMENT}")
        String checkTypes,
        @Value("${app.kyc.required-check-types:CUSTOMER_INFORMATION,IDENTITY_DOCUMENT,ADDRESS_DOCUMENT}")
        String requiredChecks,
        @Value("${app.kyc.required-document-types:IDENTITY_EVIDENCE}")
        String requiredDocuments) {
        this.cases = cases;
        this.checks = checks;
        this.decisions = decisions;
        this.approvals = approvals;
        this.statusHistory = statusHistory;
        this.communications = communications;
        this.documents = documents;
        this.caseService = caseService;
        this.audit = audit;
        this.supportedCheckTypes = Set.copyOf(parseList(checkTypes));
        this.requiredCheckTypes = parseList(requiredChecks);
        this.requiredDocumentTypes = parseList(requiredDocuments);
        if (!this.supportedCheckTypes.containsAll(this.requiredCheckTypes)) {
            throw new IllegalArgumentException("Required KYC checks must be in the supported check catalogue");
        }
    }

    @Transactional
    public KycCaseService.CaseResponse startReview(String caseId, UserAccount actor, HttpServletRequest http) {
        KycCase kycCase = lockAuthorizedCase(caseId, actor, http, "KYC_REVIEW_START");
        requireStaff(actor, caseId, http, "KYC_REVIEW_START");
        requireReviewingAnalystAccess(kycCase, actor, http, "KYC_REVIEW_START");
        if (kycCase.getStatus() != KycEnums.CaseStatus.DRAFT
            && kycCase.getStatus() != KycEnums.CaseStatus.NEEDS_INFORMATION) {
            audit.record(actor, "KYC_REVIEW_START", "KYC_CASE", caseId, "FAILURE", http);
            throw conflict("The case is not ready to enter review");
        }
        transition(kycCase, KycEnums.CaseStatus.IN_REVIEW, actor, null);
        audit.recordChange(actor, "KYC_REVIEW_STARTED", "KYC_CASE", caseId, "SUCCESS", http);
        return KycCaseService.CaseResponse.from(kycCase);
    }

    @Transactional
    public CheckResponse createCheck(String caseId, CreateCheckRequest request,
                                     UserAccount actor, HttpServletRequest http) {
        KycCase kycCase = lockAuthorizedCase(caseId, actor, http, "VERIFICATION_CHECK_CREATE");
        requireStaff(actor, caseId, http, "VERIFICATION_CHECK_CREATE");
        requireReviewingAnalystAccess(kycCase, actor, http, "VERIFICATION_CHECK_CREATE");
        requireStatus(kycCase, KycEnums.CaseStatus.IN_REVIEW, "Verification checks require an active review",
            actor, http, "VERIFICATION_CHECK_CREATE");
        if (!supportedCheckTypes.contains(request.checkType())) {
            audit.record(actor, "VERIFICATION_CHECK_CREATE", "KYC_CASE", caseId, "FAILURE", http);
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unsupported verification check type");
        }
        KycDocument document = null;
        if (request.documentId() != null) {
            document = documents.findByIdAndKycCase_Id(request.documentId(), caseId)
                .orElseThrow(VerificationWorkflowService::notFound);
        }
        VerificationCheck check = checks.save(new VerificationCheck(kycCase, document, request.checkType(),
            request.result(), request.notes(), actor));
        audit.recordChange(actor, "VERIFICATION_CHECK_CREATED", "KYC_CASE", caseId, "SUCCESS", http);
        return CheckResponse.from(check);
    }

    @Transactional(readOnly = true)
    public List<CheckResponse> listChecks(String caseId, UserAccount actor, HttpServletRequest http) {
        KycCase kycCase = caseService.authorizedCase(caseId, actor, http, "VERIFICATION_CHECK_LIST");
        requireStaff(actor, caseId, http, "VERIFICATION_CHECK_LIST");
        requireReviewingAnalystAccess(kycCase, actor, http, "VERIFICATION_CHECK_LIST");
        List<CheckResponse> result = checks.findAllByKycCase_IdOrderByCreatedAtAsc(caseId).stream()
            .map(CheckResponse::from).toList();
        audit.record(actor, "VERIFICATION_CHECK_LIST", "KYC_CASE", caseId, "SUCCESS", http);
        return result;
    }

    @Transactional
    public DecisionResponse submitDecision(String caseId, SubmitDecisionRequest request, String idempotencyKey,
                                           UserAccount actor, HttpServletRequest http) {
        validateIdempotencyKey(idempotencyKey);
        KycCase kycCase = lockAuthorizedCase(caseId, actor, http, "VERIFICATION_DECISION_SUBMIT");
        requireAnalyst(kycCase, actor, http, "VERIFICATION_DECISION_SUBMIT");
        if (idempotencyKey != null) {
            var existing = decisions.findByKycCase_IdAndSubmittedBy_IdAndIdempotencyKey(
                caseId, actor.getId(), idempotencyKey);
            if (existing.isPresent()) {
                if (!existing.get().getRequestFingerprint().equals(fingerprint(request))) {
                    throw conflict("Idempotency-Key was already used for a different decision");
                }
                return decisionResponse(existing.get());
            }
        }
        requireStatus(kycCase, KycEnums.CaseStatus.IN_REVIEW, "The case is not accepting a decision",
            actor, http, "VERIFICATION_DECISION_SUBMIT");
        if (request.outcome() != VerificationEnums.DecisionOutcome.NEEDS_INFORMATION) {
            validateReadiness(caseId, request.outcome(), actor, http);
        } else if (request.rationale() == null || request.rationale().isBlank()) {
            audit.record(actor, "VERIFICATION_DECISION_SUBMIT", "KYC_CASE", caseId, "FAILURE", http);
            throw new ApiException(HttpStatus.BAD_REQUEST,
                "A rationale is required when requesting additional information");
        }
        boolean approvalRequired = request.outcome() != VerificationEnums.DecisionOutcome.NEEDS_INFORMATION
            && kycCase.getRiskLevel() == KycEnums.RiskLevel.HIGH;
        VerificationDecision decision = decisions.saveAndFlush(new VerificationDecision(
            kycCase, actor, request.outcome(), request.reasonCode(), request.rationale(),
            approvalRequired, idempotencyKey, fingerprint(request)));
        KycEnums.CaseStatus nextStatus;
        if (request.outcome() == VerificationEnums.DecisionOutcome.NEEDS_INFORMATION) {
            nextStatus = KycEnums.CaseStatus.NEEDS_INFORMATION;
            communications.recordInformationRequest(kycCase, decision, actor, http);
        } else if (approvalRequired) {
            nextStatus = KycEnums.CaseStatus.PENDING_SUPERVISOR_APPROVAL;
        } else {
            nextStatus = request.outcome() == VerificationEnums.DecisionOutcome.APPROVE
                ? KycEnums.CaseStatus.APPROVED : KycEnums.CaseStatus.REJECTED;
        }
        transition(kycCase, nextStatus, actor, request.reasonCode());
        audit.recordChange(actor, "VERIFICATION_DECISION_SUBMITTED", "KYC_CASE", caseId, "SUCCESS", http);
        return decisionResponse(decision);
    }

    @Transactional(readOnly = true)
    public List<DecisionResponse> listDecisions(String caseId, UserAccount actor, HttpServletRequest http) {
        KycCase kycCase = caseService.authorizedCase(caseId, actor, http, "VERIFICATION_DECISION_LIST");
        requireStaff(actor, caseId, http, "VERIFICATION_DECISION_LIST");
        requireReviewingAnalystAccess(kycCase, actor, http, "VERIFICATION_DECISION_LIST");
        List<DecisionResponse> result = decisions.findAllByKycCase_IdOrderByCreatedAtDesc(caseId).stream()
            .map(this::decisionResponse).toList();
        audit.record(actor, "VERIFICATION_DECISION_LIST", "KYC_CASE", caseId, "SUCCESS", http);
        return result;
    }

    @Transactional(readOnly = true)
    public List<DecisionResponse> pendingApprovals(String caseId, UserAccount actor, HttpServletRequest http) {
        KycCase kycCase = caseService.authorizedCase(caseId, actor, http, "SUPERVISOR_APPROVAL_LIST");
        requireSupervisor(actor, caseId, http, "SUPERVISOR_APPROVAL_LIST");
        requireStatus(kycCase, KycEnums.CaseStatus.PENDING_SUPERVISOR_APPROVAL,
            "The case has no pending supervisor approval", actor, http, "SUPERVISOR_APPROVAL_LIST");
        List<DecisionResponse> pending = decisions
            .findAllByKycCase_IdAndApprovalRequiredTrueOrderByCreatedAtAsc(caseId).stream()
            .filter(decision -> approvals.findByDecision_Id(decision.getId()).isEmpty())
            .map(this::decisionResponse).toList();
        audit.record(actor, "SUPERVISOR_APPROVAL_LIST", "KYC_CASE", caseId, "SUCCESS", http);
        return pending;
    }

    @Transactional
    public DecisionResponse reviewDecision(String caseId, String decisionId,
                                           ReviewDecisionRequest request, UserAccount actor,
                                           HttpServletRequest http) {
        requireSupervisor(actor, caseId, http, "SUPERVISOR_APPROVAL");
        KycCase kycCase = lockAuthorizedCase(caseId, actor, http, "SUPERVISOR_APPROVAL");
        VerificationDecision decision = decisions.findById(decisionId)
            .filter(candidate -> candidate.getKycCase().getId().equals(caseId))
            .orElseThrow(() -> {
                audit.record(actor, "SUPERVISOR_APPROVAL", "KYC_CASE", caseId, "DENIED", http);
                return notFound();
            });
        requireStatus(kycCase, KycEnums.CaseStatus.PENDING_SUPERVISOR_APPROVAL,
            "The case is not awaiting supervisor approval", actor, http, "SUPERVISOR_APPROVAL");
        if (!decision.isApprovalRequired() || approvals.findByDecision_Id(decisionId).isPresent()) {
            audit.record(actor, "SUPERVISOR_APPROVAL", "KYC_CASE", caseId, "FAILURE", http);
            throw conflict("This decision is not awaiting approval");
        }
        if (decision.getSubmittedBy().getId().equals(actor.getId())) {
            audit.record(actor, "SUPERVISOR_APPROVAL", "KYC_CASE", caseId, "DENIED", http);
            throw new ApiException(HttpStatus.FORBIDDEN, "A decision submitter cannot approve their own decision");
        }
        approvals.saveAndFlush(new SupervisorApproval(decision, actor, request.outcome(), request.reason()));
        if (request.outcome() == VerificationEnums.ApprovalOutcome.APPROVED) {
            KycEnums.CaseStatus finalStatus = decision.getOutcome() == VerificationEnums.DecisionOutcome.APPROVE
                ? KycEnums.CaseStatus.APPROVED : KycEnums.CaseStatus.REJECTED;
            transition(kycCase, finalStatus, actor, "SUPERVISOR_APPROVED");
        } else {
            transition(kycCase, KycEnums.CaseStatus.IN_REVIEW, actor, "SUPERVISOR_RETURNED_FOR_REVIEW");
        }
        audit.recordChange(actor, "SUPERVISOR_DECISION_REVIEWED", "KYC_CASE", caseId, "SUCCESS", http);
        return decisionResponse(decision);
    }

    @Transactional
    public KycCaseService.CaseResponse closeCase(String caseId, UserAccount actor, HttpServletRequest http) {
        requireSupervisor(actor, caseId, http, "KYC_CASE_CLOSE");
        KycCase kycCase = lockAuthorizedCase(caseId, actor, http, "KYC_CASE_CLOSE");
        if (kycCase.getStatus() != KycEnums.CaseStatus.APPROVED
            && kycCase.getStatus() != KycEnums.CaseStatus.REJECTED) {
            audit.record(actor, "KYC_CASE_CLOSE", "KYC_CASE", caseId, "FAILURE", http);
            throw conflict("Only a completed and decided case can be closed");
        }
        transition(kycCase, KycEnums.CaseStatus.CLOSED, actor, "CASE_CLOSED");
        audit.recordChange(actor, "KYC_CASE_CLOSED", "KYC_CASE", caseId, "SUCCESS", http);
        return KycCaseService.CaseResponse.from(kycCase);
    }

    private void validateReadiness(String caseId, VerificationEnums.DecisionOutcome outcome,
                                   UserAccount actor, HttpServletRequest http) {
        Map<String, VerificationCheck> latestChecks = new LinkedHashMap<>();
        for (VerificationCheck check : checks.findAllByKycCase_IdOrderByCreatedAtAsc(caseId)) {
            latestChecks.put(check.getCheckType(), check);
        }
        List<String> incompleteChecks = requiredCheckTypes.stream()
            .filter(type -> {
                VerificationCheck check = latestChecks.get(type);
                return check == null || check.getResult() == VerificationEnums.CheckResult.NEEDS_INFORMATION;
            }).toList();
        if (!incompleteChecks.isEmpty()) {
            audit.record(actor, "VERIFICATION_DECISION_SUBMIT", "KYC_CASE", caseId, "FAILURE", http);
            throw conflict("Mandatory verification checks are incomplete");
        }
        List<KycDocument> caseDocuments = documents.findAllByKycCase_IdOrderByCreatedAtDesc(caseId);
        for (String requiredType : requiredDocumentTypes) {
            boolean complete = caseDocuments.stream().anyMatch(document ->
                document.getDocumentType().equals(requiredType)
                    && document.getStatus() != DocumentStatus.PENDING_REVIEW);
            if (!complete) {
                audit.record(actor, "VERIFICATION_DECISION_SUBMIT", "KYC_CASE", caseId, "FAILURE", http);
                throw conflict("Required documents are missing or still pending review");
            }
            if (outcome == VerificationEnums.DecisionOutcome.APPROVE
                && caseDocuments.stream().noneMatch(document ->
                    document.getDocumentType().equals(requiredType)
                        && document.getStatus() == DocumentStatus.ACCEPTED)) {
                audit.record(actor, "VERIFICATION_DECISION_SUBMIT", "KYC_CASE", caseId, "FAILURE", http);
                throw conflict("Required documents must be accepted before approval");
            }
        }
        if (outcome == VerificationEnums.DecisionOutcome.APPROVE) {
            List<String> failedChecks = requiredCheckTypes.stream()
                .filter(type -> latestChecks.get(type).getResult() != VerificationEnums.CheckResult.PASS)
                .toList();
            if (!failedChecks.isEmpty()) {
                audit.record(actor, "VERIFICATION_DECISION_SUBMIT", "KYC_CASE", caseId, "FAILURE", http);
                throw conflict("All mandatory verification checks must pass before approval");
            }
        }
    }

    private KycCase lockAuthorizedCase(String caseId, UserAccount actor,
                                      HttpServletRequest http, String event) {
        KycCase kycCase = cases.lockById(caseId).orElseThrow(VerificationWorkflowService::notFound);
        KycCase authorized = caseService.authorizedCase(caseId, actor, http, event);
        if (!authorized.getId().equals(kycCase.getId())) {
            throw notFound();
        }
        return kycCase;
    }

    private void requireAnalyst(KycCase kycCase, UserAccount actor,
                                HttpServletRequest http, String event) {
        if (!actor.hasRole("KYC_ANALYST") || kycCase.getAssignedTo() == null
            || !kycCase.getAssignedTo().getId().equals(actor.getId())) {
            audit.record(actor, event, "KYC_CASE", kycCase.getId(), "DENIED", http);
            throw forbidden();
        }
    }

    private void requireReviewingAnalystAccess(KycCase kycCase, UserAccount actor,
                                               HttpServletRequest http, String event) {
        if (actor.hasRole("COMPLIANCE_SUPERVISOR")) {
            return;
        }
        if (!actor.hasRole("KYC_ANALYST") || kycCase.getAssignedTo() == null
            || !kycCase.getAssignedTo().getId().equals(actor.getId())) {
            audit.record(actor, event, "KYC_CASE", kycCase.getId(), "DENIED", http);
            throw forbidden();
        }
    }

    private void requireStaff(UserAccount actor, String caseId, HttpServletRequest http, String event) {
        if (!actor.hasRole("KYC_ANALYST") && !actor.hasRole("COMPLIANCE_SUPERVISOR")) {
            audit.record(actor, event, "KYC_CASE", caseId, "DENIED", http);
            throw forbidden();
        }
    }

    private void requireSupervisor(UserAccount actor, String caseId, HttpServletRequest http, String event) {
        if (!actor.hasRole("COMPLIANCE_SUPERVISOR")) {
            audit.record(actor, event, "KYC_CASE", caseId, "DENIED", http);
            throw forbidden();
        }
    }

    private void requireStatus(KycCase kycCase, KycEnums.CaseStatus expected, String message,
                               UserAccount actor, HttpServletRequest http, String event) {
        if (kycCase.getStatus() != expected) {
            audit.record(actor, event, "KYC_CASE", kycCase.getId(), "FAILURE", http);
            throw conflict(message);
        }
    }

    private DecisionResponse decisionResponse(VerificationDecision decision) {
        SupervisorApproval approval = approvals.findByDecision_Id(decision.getId()).orElse(null);
        String approvalOutcome = approval == null
            ? decision.isApprovalRequired() ? "PENDING" : "NOT_REQUIRED"
            : approval.getOutcome().name();
        return DecisionResponse.from(decision, approvalOutcome,
            approval == null ? null : approval.getReviewedBy().getId(),
            approval == null ? null : approval.getReason(),
            approval == null ? null : approval.getCreatedAt());
    }

    @Transactional(readOnly = true)
    public List<StatusHistoryResponse> statusHistory(String caseId, UserAccount actor, HttpServletRequest http) {
        KycCase kycCase = caseService.authorizedCase(caseId, actor, http, "KYC_CASE_STATUS_HISTORY");
        requireStaff(actor, caseId, http, "KYC_CASE_STATUS_HISTORY");
        requireReviewingAnalystAccess(kycCase, actor, http, "KYC_CASE_STATUS_HISTORY");
        List<StatusHistoryResponse> result = statusHistory
            .findAllByKycCase_IdOrderByCreatedAtAsc(caseId).stream()
            .map(StatusHistoryResponse::from).toList();
        audit.record(actor, "KYC_CASE_STATUS_HISTORY", "KYC_CASE", caseId, "SUCCESS", http);
        return result;
    }

    private void transition(KycCase kycCase, KycEnums.CaseStatus next,
                            UserAccount actor, String reasonCode) {
        KycEnums.CaseStatus previous = kycCase.getStatus();
        kycCase.transitionFromWorkflow(next);
        statusHistory.save(new CaseStatusHistory(kycCase, previous, next, actor, reasonCode));
    }

    private String fingerprint(SubmitDecisionRequest request) {
        String value = request.outcome().name() + "\n" + request.reasonCode() + "\n"
            + (request.rationale() == null ? "" : request.rationale());
        return digest(value.getBytes(StandardCharsets.UTF_8));
    }

    private String digest(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the Java runtime", exception);
        }
    }

    private void validateIdempotencyKey(String key) {
        if (key != null && !key.matches("[A-Za-z0-9._:-]{1,128}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid Idempotency-Key header");
        }
    }

    private static List<String> parseList(String configured) {
        if (configured == null || configured.isBlank()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (String item : configured.split(",")) {
            String value = item.trim();
            if (!value.matches("[A-Z][A-Z0-9_]{0,59}") || values.contains(value)) {
                throw new IllegalArgumentException("Invalid or duplicate KYC workflow catalogue value");
            }
            values.add(value);
        }
        return List.copyOf(values);
    }

    private static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }

    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "This operation is not permitted");
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "KYC case or decision not found");
    }

    public record CreateCheckRequest(
        @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{0,59}") String checkType,
        @NotNull VerificationEnums.CheckResult result,
        @Size(max = 500) String notes,
        @Size(max = 36) String documentId) {
    }

    public record SubmitDecisionRequest(
        @NotNull VerificationEnums.DecisionOutcome outcome,
        @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{0,59}") String reasonCode,
        @Size(max = 1000) String rationale) {
    }

    public record ReviewDecisionRequest(
        @NotNull VerificationEnums.ApprovalOutcome outcome,
        @Size(max = 1000) String reason) {
        @AssertTrue(message = "A reason is required when rejecting a submitted decision")
        public boolean isValid() {
            return outcome != VerificationEnums.ApprovalOutcome.REJECTED
                || (reason != null && !reason.isBlank());
        }
    }

    public record CheckResponse(String id, String caseId, String documentId, String checkType,
                                VerificationEnums.CheckResult result, String notes,
                                String performedByUserId, java.time.Instant performedAt) {
        static CheckResponse from(VerificationCheck check) {
            return new CheckResponse(check.getId(), check.getKycCase().getId(),
                check.getDocument() == null ? null : check.getDocument().getId(),
                check.getCheckType(), check.getResult(), check.getNotes(),
                check.getPerformedBy().getId(), check.getCreatedAt());
        }
    }

    public record DecisionResponse(String id, String caseId, String submittedByUserId,
                                   VerificationEnums.DecisionOutcome outcome, String reasonCode,
                                   String rationale, boolean approvalRequired, String approvalOutcome,
                                   String reviewedByUserId, String reviewReason,
                                   java.time.Instant reviewedAt, java.time.Instant submittedAt) {
        static DecisionResponse from(VerificationDecision decision, String approvalOutcome,
                                     String reviewedByUserId, String reviewReason,
                                     java.time.Instant reviewedAt) {
            return new DecisionResponse(decision.getId(), decision.getKycCase().getId(),
                decision.getSubmittedBy().getId(), decision.getOutcome(), decision.getReasonCode(),
                decision.getRationale(), decision.isApprovalRequired(), approvalOutcome,
                reviewedByUserId, reviewReason, reviewedAt, decision.getCreatedAt());
        }
    }

    public record StatusHistoryResponse(String id, String fromStatus, String toStatus,
                                        String changedByUserId, String reasonCode,
                                        java.time.Instant changedAt) {
        static StatusHistoryResponse from(CaseStatusHistory history) {
            return new StatusHistoryResponse(history.getId(), history.getFromStatus().name(),
                history.getToStatus().name(), history.getChangedBy().getId(),
                history.getReasonCode(), history.getCreatedAt());
        }
    }
}
