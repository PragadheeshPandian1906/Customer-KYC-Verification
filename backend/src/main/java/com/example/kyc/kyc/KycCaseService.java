package com.example.kyc.kyc;

import com.example.kyc.audit.AuditService;
import com.example.kyc.common.ApiException;
import com.example.kyc.common.PageResponse;
import com.example.kyc.customer.Customer;
import com.example.kyc.customer.CustomerRepository;
import com.example.kyc.user.UserAccount;
import com.example.kyc.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class KycCaseService {
    private final KycCaseRepository cases;
    private final CustomerRepository customers;
    private final UserRepository users;
    private final CaseAssignmentRepository assignments;
    private final AuditService audit;
    private final TransactionTemplate transactionTemplate;

    public KycCaseService(KycCaseRepository cases, CustomerRepository customers, UserRepository users,
                          CaseAssignmentRepository assignments, AuditService audit,
                          PlatformTransactionManager transactionManager) {
        this.cases = cases;
        this.customers = customers;
        this.users = users;
        this.assignments = assignments;
        this.audit = audit;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public CaseResponse create(CreateCaseRequest request, String idempotencyKey, UserAccount actor,
                               HttpServletRequest http) {
        try {
            return transactionTemplate.execute(status -> createWithinTransaction(request, idempotencyKey, actor, http));
        } catch (DataIntegrityViolationException exception) {
            if (idempotencyKey != null) {
                return transactionTemplate.execute(status -> cases.findByCreatedBy_IdAndIdempotencyKey(
                    actor.getId(), idempotencyKey)
                    .filter(existing -> sameRequest(existing, request))
                    .map(CaseResponse::from)
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                        "Case reference or idempotency key conflicts with an existing record")));
            }
            throw new ApiException(HttpStatus.CONFLICT, "Case reference conflicts with an existing record");
        }
    }

    private CaseResponse createWithinTransaction(CreateCaseRequest request, String idempotencyKey,
                                                 UserAccount actor, HttpServletRequest http) {
        if (!staff(actor) && !actor.hasRole("CUSTOMER")) {
            throw forbidden();
        }
        Customer customer = customers.findById(request.customerId()).orElseThrow(KycCaseService::notFound);
        if (actor.hasRole("CUSTOMER")
            && (customer.getOwner() == null || !customer.getOwner().getId().equals(actor.getId()))) {
            throw notFound();
        }
        if (idempotencyKey != null) {
            if (idempotencyKey.isBlank() || idempotencyKey.length() > 128) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid Idempotency-Key header");
            }
            var existing = cases.findByCreatedBy_IdAndIdempotencyKey(actor.getId(), idempotencyKey);
            if (existing.isPresent()) {
                KycCase saved = existing.get();
                if (!sameRequest(saved, request)) {
                    throw new ApiException(HttpStatus.CONFLICT, "Idempotency-Key was already used for a different request");
                }
                return CaseResponse.from(saved);
            }
        }
        KycCase kycCase = cases.saveAndFlush(new KycCase(customer, request.caseType(), request.riskLevel(),
            request.priority(), idempotencyKey, actor));
        audit.recordChange(actor, "KYC_CASE_CREATED", "KYC_CASE", kycCase.getId(), "SUCCESS", http);
        return CaseResponse.from(kycCase);
    }

    private boolean sameRequest(KycCase existing, CreateCaseRequest request) {
        return existing.getCustomer().getId().equals(request.customerId())
            && existing.getCaseType() == request.caseType()
            && existing.getRiskLevel() == request.riskLevel()
            && existing.getPriority() == request.priority();
    }

    @Transactional(readOnly = true)
    public PageResponse<CaseResponse> list(UserAccount actor, int page, int size, String sortBy,
                                           HttpServletRequest http) {
        validatePage(page, size, sortBy);
        PageRequest pageable = PageRequest.of(page, size, Sort.by(sortBy).descending());
        Page<KycCase> result;
        if (actor.hasRole("COMPLIANCE_SUPERVISOR")) {
            result = cases.findAll(pageable);
        } else if (actor.hasRole("KYC_ANALYST")) {
            result = cases.findAllByAssignedTo_Id(actor.getId(), pageable);
        } else if (actor.hasRole("CUSTOMER")) {
            result = cases.findAllByCustomer_Owner_Id(actor.getId(), pageable);
        } else {
            audit.record(actor, "KYC_CASE_LIST", "KYC_CASE", null, "DENIED", http);
            throw forbidden();
        }
        audit.record(actor, "KYC_CASE_LIST", "KYC_CASE", null, "SUCCESS", http);
        return PageResponse.from(result.map(CaseResponse::from));
    }

    @Transactional(readOnly = true)
    public CaseResponse get(String caseId, UserAccount actor, HttpServletRequest http) {
        KycCase kycCase = findCase(caseId);
        requireAccess(kycCase, actor, http, "KYC_CASE_READ");
        audit.record(actor, "KYC_CASE_READ", "KYC_CASE", caseId, "SUCCESS", http);
        return CaseResponse.from(kycCase);
    }

    @Transactional
    public CaseResponse update(String caseId, UpdateCaseRequest request, UserAccount actor,
                              HttpServletRequest http) {
        KycCase kycCase = cases.lockById(caseId).orElseThrow(KycCaseService::notFound);
        requireStaffCaseAccess(kycCase, actor, http, "KYC_CASE_UPDATE");
        if (request.riskLevel() != null || request.priority() != null) {
            if (!actor.hasRole("COMPLIANCE_SUPERVISOR")) {
                throw forbidden();
            }
            if (kycCase.getStatus() != KycEnums.CaseStatus.DRAFT
                && kycCase.getStatus() != KycEnums.CaseStatus.IN_REVIEW) {
                throw new ApiException(HttpStatus.CONFLICT,
                    "Risk and priority can only be changed before a decision is submitted");
            }
            kycCase.update(request.riskLevel(), request.priority());
        }
        audit.recordChange(actor, "KYC_CASE_UPDATED", "KYC_CASE", kycCase.getId(), "SUCCESS", http);
        return CaseResponse.from(kycCase);
    }

    @Transactional(readOnly = true)
    public CaseResponse status(String caseId, UserAccount actor, HttpServletRequest http) {
        return get(caseId, actor, http);
    }

    @Transactional(readOnly = true)
    public KycCase authorizedCase(String caseId, UserAccount actor, HttpServletRequest http, String event) {
        KycCase kycCase = findCase(caseId);
        requireAccess(kycCase, actor, http, event);
        return kycCase;
    }

    @Transactional
    public KycCase lockAuthorizedCase(String caseId, UserAccount actor,
                                      HttpServletRequest http, String event) {
        KycCase kycCase = cases.lockById(caseId).orElseThrow(KycCaseService::notFound);
        requireAccess(kycCase, actor, http, event);
        return kycCase;
    }

    @Transactional(readOnly = true)
    public PageResponse<CaseResponse> customerCases(String customerId, UserAccount actor, int page, int size,
                                                    HttpServletRequest http) {
        validatePage(page, size, "createdAt");
        Customer customer = customers.findById(customerId).orElseThrow(KycCaseService::notFound);
        if (actor.hasRole("CUSTOMER")) {
            if (customer.getOwner() == null || !customer.getOwner().getId().equals(actor.getId())) {
                audit.record(actor, "CUSTOMER_CASE_LIST", "CUSTOMER", customerId, "DENIED", http);
                throw notFound();
            }
            audit.record(actor, "CUSTOMER_CASE_LIST", "CUSTOMER", customerId, "SUCCESS", http);
            return PageResponse.from(cases.findAllByCustomer_Owner_Id(actor.getId(),
                PageRequest.of(page, size, Sort.by("createdAt").descending())).map(CaseResponse::from));
        }
        if (actor.hasRole("KYC_ANALYST")) {
            audit.record(actor, "CUSTOMER_CASE_LIST", "CUSTOMER", customerId, "SUCCESS", http);
            return PageResponse.from(cases.findAllByCustomer_IdAndAssignedTo_Id(customerId, actor.getId(),
                PageRequest.of(page, size, Sort.by("createdAt").descending())).map(CaseResponse::from));
        }
        if (!actor.hasRole("COMPLIANCE_SUPERVISOR")) {
            audit.record(actor, "CUSTOMER_CASE_LIST", "CUSTOMER", customerId, "DENIED", http);
            throw forbidden();
        }
        audit.record(actor, "CUSTOMER_CASE_LIST", "CUSTOMER", customerId, "SUCCESS", http);
        return PageResponse.from(cases.findAllByCustomer_Id(customerId,
            PageRequest.of(page, size, Sort.by("createdAt").descending())).map(CaseResponse::from));
    }

    @Transactional
    public List<AssignmentResponse> assign(String caseId, AssignmentRequest request, UserAccount actor,
                                           HttpServletRequest http) {
        if (!actor.hasRole("COMPLIANCE_SUPERVISOR")) {
            audit.record(actor, "KYC_CASE_ASSIGN", "KYC_CASE", caseId, "DENIED", http);
            throw forbidden();
        }
        KycCase kycCase = cases.lockById(caseId).orElseThrow(KycCaseService::notFound);
        if (kycCase.getStatus() == KycEnums.CaseStatus.APPROVED
            || kycCase.getStatus() == KycEnums.CaseStatus.REJECTED
            || kycCase.getStatus() == KycEnums.CaseStatus.CLOSED) {
            throw new ApiException(HttpStatus.CONFLICT, "A completed KYC case cannot be assigned");
        }
        UserAccount analyst = users.findById(request.analystUserId())
            .filter(user -> user.isEnabled() && user.hasRole("KYC_ANALYST"))
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "The selected user is not an eligible analyst"));
        var current = assignments.findFirstByKycCase_IdAndEndedAtIsNullOrderByAssignedAtDesc(caseId);
        if (current.isPresent() && current.get().getAnalyst().getId().equals(analyst.getId())) {
            return assignmentHistory(caseId);
        }
        current.ifPresent(CaseAssignment::end);
        kycCase.assign(analyst);
        assignments.save(new CaseAssignment(kycCase, analyst, actor));
        audit.record(actor, "KYC_CASE_ASSIGNED", "KYC_CASE", kycCase.getId(), "SUCCESS", http);
        return assignmentHistory(caseId);
    }

    @Transactional(readOnly = true)
    public List<AssignmentResponse> assignments(String caseId, UserAccount actor, HttpServletRequest http) {
        if (!actor.hasRole("COMPLIANCE_SUPERVISOR") && !actor.hasRole("KYC_ANALYST")) {
            audit.record(actor, "KYC_ASSIGNMENTS_READ", "KYC_CASE", caseId, "DENIED", http);
            throw forbidden();
        }
        requireAccess(findCase(caseId), actor, http, "KYC_ASSIGNMENTS_READ");
        audit.record(actor, "KYC_ASSIGNMENTS_READ", "KYC_CASE", caseId, "SUCCESS", http);
        return assignmentHistory(caseId);
    }

    private List<AssignmentResponse> assignmentHistory(String caseId) {
        return assignments.findAllByKycCase_IdOrderByAssignedAtDesc(caseId).stream()
            .map(AssignmentResponse::from).toList();
    }

    private void requireAccess(KycCase kycCase, UserAccount actor, HttpServletRequest http, String event) {
        boolean allowed = actor.hasRole("COMPLIANCE_SUPERVISOR")
            || (actor.hasRole("CUSTOMER") && kycCase.getCustomer().getOwner() != null
                && kycCase.getCustomer().getOwner().getId().equals(actor.getId()))
            || (actor.hasRole("KYC_ANALYST") && kycCase.getAssignedTo() != null
                && kycCase.getAssignedTo().getId().equals(actor.getId()));
        if (!allowed) {
            audit.record(actor, event, "KYC_CASE", kycCase.getId(), "DENIED", http);
            throw notFound();
        }
    }

    private void requireStaffCaseAccess(KycCase kycCase, UserAccount actor, HttpServletRequest http, String event) {
        if (!staff(actor)) {
            throw forbidden();
        }
        requireAccess(kycCase, actor, http, event);
    }

    private KycCase findCase(String id) {
        return cases.findById(id).orElseThrow(KycCaseService::notFound);
    }

    private void validatePage(int page, int size, String sortBy) {
        if (page < 0 || size < 1 || size > 100 || !java.util.Set.of("createdAt", "updatedAt").contains(sortBy)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid pagination or sort parameter");
        }
    }

    private boolean staff(UserAccount user) {
        return user.hasRole("KYC_ANALYST") || user.hasRole("COMPLIANCE_SUPERVISOR");
    }

    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "This operation is not permitted");
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "KYC case or customer not found");
    }

    public record CreateCaseRequest(
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 36) String customerId,
        @jakarta.validation.constraints.NotNull KycEnums.CaseType caseType,
        @jakarta.validation.constraints.NotNull KycEnums.RiskLevel riskLevel,
        @jakarta.validation.constraints.NotNull KycEnums.Priority priority) {
    }

    public record UpdateCaseRequest(KycEnums.RiskLevel riskLevel, KycEnums.Priority priority,
                                   KycEnums.CaseStatus status) {
        @jakarta.validation.constraints.AssertTrue(message = "At least one case field must be provided")
        public boolean isValid() {
            return riskLevel != null || priority != null;
        }

        @jakarta.validation.constraints.AssertTrue(message = "Case status must be changed through a workflow operation")
        public boolean isStatusNotModified() {
            return status == null;
        }
    }

    public record AssignmentRequest(@jakarta.validation.constraints.NotBlank
                                    @jakarta.validation.constraints.Size(max = 36) String analystUserId) {
    }

    public record CaseResponse(String id, String caseReference, String customerId, KycEnums.CaseType caseType,
                               KycEnums.CaseStatus status, KycEnums.RiskLevel riskLevel,
                               KycEnums.Priority priority, String assignedToUserId, long version,
                               java.time.Instant createdAt, java.time.Instant updatedAt) {
        static CaseResponse from(KycCase kycCase) {
            return new CaseResponse(kycCase.getId(), kycCase.getCaseReference(),
                kycCase.getCustomer().getId(), kycCase.getCaseType(), kycCase.getStatus(),
                kycCase.getRiskLevel(), kycCase.getPriority(),
                kycCase.getAssignedTo() == null ? null : kycCase.getAssignedTo().getId(),
                kycCase.getVersion(), kycCase.getCreatedAt(), kycCase.getUpdatedAt());
        }
    }

    public record AssignmentResponse(String id, String analystUserId, String assignedByUserId,
                                     java.time.Instant assignedAt, java.time.Instant endedAt) {
        static AssignmentResponse from(CaseAssignment assignment) {
            return new AssignmentResponse(assignment.getId(), assignment.getAnalyst().getId(),
                assignment.getAssignedBy().getId(), assignment.getAssignedAt(), assignment.getEndedAt());
        }
    }
}
