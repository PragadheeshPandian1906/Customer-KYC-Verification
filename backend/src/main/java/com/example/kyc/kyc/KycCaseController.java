package com.example.kyc.kyc;

import com.example.kyc.common.PageResponse;
import com.example.kyc.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/kyc/cases")
public class KycCaseController {
    private final KycCaseService service;
    private final VerificationWorkflowService workflow;

    public KycCaseController(KycCaseService service, VerificationWorkflowService workflow) {
        this.service = service;
        this.workflow = workflow;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public KycCaseService.CaseResponse create(@Valid @RequestBody KycCaseService.CreateCaseRequest request,
                                              @RequestHeader(value = "Idempotency-Key", required = false)
                                              String idempotencyKey,
                                              @AuthenticationPrincipal UserAccount actor,
                                              HttpServletRequest http) {
        return service.create(request, idempotencyKey, actor, http);
    }

    @GetMapping
    public PageResponse<KycCaseService.CaseResponse> list(
        @AuthenticationPrincipal UserAccount actor,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "createdAt") String sortBy,
        HttpServletRequest http) {
        return service.list(actor, page, size, sortBy, http);
    }

    @GetMapping("/{caseId}")
    public KycCaseService.CaseResponse get(@PathVariable String caseId,
                                           @AuthenticationPrincipal UserAccount actor,
                                           HttpServletRequest http) {
        return service.get(caseId, actor, http);
    }

    @PatchMapping("/{caseId}")
    public KycCaseService.CaseResponse update(@PathVariable String caseId,
                                              @NotNull @Valid @RequestBody KycCaseService.UpdateCaseRequest request,
                                              @AuthenticationPrincipal UserAccount actor,
                                              HttpServletRequest http) {
        return service.update(caseId, request, actor, http);
    }

    @GetMapping("/{caseId}/status")
    public KycCaseService.CaseResponse status(@PathVariable String caseId,
                                              @AuthenticationPrincipal UserAccount actor,
                                              HttpServletRequest http) {
        return service.status(caseId, actor, http);
    }

    @GetMapping("/{caseId}/status/history")
    public List<VerificationWorkflowService.StatusHistoryResponse> statusHistory(
        @PathVariable String caseId,
        @AuthenticationPrincipal UserAccount actor,
        HttpServletRequest http) {
        return workflow.statusHistory(caseId, actor, http);
    }

    @PostMapping("/{caseId}/review/start")
    public KycCaseService.CaseResponse startReview(@PathVariable String caseId,
                                                    @AuthenticationPrincipal UserAccount actor,
                                                    HttpServletRequest http) {
        return workflow.startReview(caseId, actor, http);
    }

    @PostMapping("/{caseId}/verification-checks")
    @ResponseStatus(HttpStatus.CREATED)
    public VerificationWorkflowService.CheckResponse createVerificationCheck(
        @PathVariable String caseId,
        @Valid @RequestBody VerificationWorkflowService.CreateCheckRequest request,
        @AuthenticationPrincipal UserAccount actor,
        HttpServletRequest http) {
        return workflow.createCheck(caseId, request, actor, http);
    }

    @GetMapping("/{caseId}/verification-checks")
    public List<VerificationWorkflowService.CheckResponse> listVerificationChecks(
        @PathVariable String caseId,
        @AuthenticationPrincipal UserAccount actor,
        HttpServletRequest http) {
        return workflow.listChecks(caseId, actor, http);
    }

    @PostMapping("/{caseId}/verification-results")
    @ResponseStatus(HttpStatus.CREATED)
    public VerificationWorkflowService.DecisionResponse submitVerificationResult(
        @PathVariable String caseId,
        @Valid @RequestBody VerificationWorkflowService.SubmitDecisionRequest request,
        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
        @AuthenticationPrincipal UserAccount actor,
        HttpServletRequest http) {
        return workflow.submitDecision(caseId, request, idempotencyKey, actor, http);
    }

    @GetMapping("/{caseId}/verification-decisions")
    public List<VerificationWorkflowService.DecisionResponse> listVerificationDecisions(
        @PathVariable String caseId,
        @AuthenticationPrincipal UserAccount actor,
        HttpServletRequest http) {
        return workflow.listDecisions(caseId, actor, http);
    }

    @GetMapping("/{caseId}/approvals/pending")
    public List<VerificationWorkflowService.DecisionResponse> pendingApprovals(
        @PathVariable String caseId,
        @AuthenticationPrincipal UserAccount actor,
        HttpServletRequest http) {
        return workflow.pendingApprovals(caseId, actor, http);
    }

    @PostMapping("/{caseId}/verification-decisions/{decisionId}/approval")
    public VerificationWorkflowService.DecisionResponse reviewDecision(
        @PathVariable String caseId,
        @PathVariable String decisionId,
        @Valid @RequestBody VerificationWorkflowService.ReviewDecisionRequest request,
        @AuthenticationPrincipal UserAccount actor,
        HttpServletRequest http) {
        return workflow.reviewDecision(caseId, decisionId, request, actor, http);
    }

    @PostMapping("/{caseId}/close")
    public KycCaseService.CaseResponse close(@PathVariable String caseId,
                                             @AuthenticationPrincipal UserAccount actor,
                                             HttpServletRequest http) {
        return workflow.closeCase(caseId, actor, http);
    }

    @PostMapping("/{caseId}/assignments")
    public List<KycCaseService.AssignmentResponse> assign(@PathVariable String caseId,
                                                          @Valid @RequestBody KycCaseService.AssignmentRequest request,
                                                          @AuthenticationPrincipal UserAccount actor,
                                                          HttpServletRequest http) {
        return service.assign(caseId, request, actor, http);
    }

    @GetMapping("/{caseId}/assignments")
    public List<KycCaseService.AssignmentResponse> assignments(@PathVariable String caseId,
                                                               @AuthenticationPrincipal UserAccount actor,
                                                               HttpServletRequest http) {
        return service.assignments(caseId, actor, http);
    }
}
