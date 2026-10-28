package com.example.kyc.kyc;

import com.example.kyc.common.PageResponse;
import com.example.kyc.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customers/{customerId}/cases")
public class CustomerCaseController {
    private final KycCaseService service;

    public CustomerCaseController(KycCaseService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<KycCaseService.CaseResponse> list(
        @PathVariable String customerId,
        @AuthenticationPrincipal UserAccount actor,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        HttpServletRequest http) {
        return service.customerCases(customerId, actor, page, size, http);
    }
}
