package com.example.kyc.kyc;

import com.example.kyc.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/kyc/cases/{caseId}/communications")
public class CaseCommunicationController {
    private final CaseCommunicationService communications;

    public CaseCommunicationController(CaseCommunicationService communications) {
        this.communications = communications;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('CUSTOMER', 'KYC_ANALYST', 'COMPLIANCE_SUPERVISOR')")
    public List<CaseCommunicationService.CommunicationResponse> list(
        @PathVariable String caseId, @AuthenticationPrincipal UserAccount actor,
        HttpServletRequest http) {
        return communications.list(caseId, actor, http);
    }

    @PostMapping("/responses")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('CUSTOMER')")
    public CaseCommunicationService.CommunicationResponse respond(
        @PathVariable String caseId,
        @Valid @RequestBody CaseCommunicationService.CustomerResponseRequest request,
        @AuthenticationPrincipal UserAccount actor, HttpServletRequest http) {
        return communications.respond(caseId, request, actor, http);
    }
}
