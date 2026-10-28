package com.example.kyc.customer;

import com.example.kyc.common.PageResponse;
import com.example.kyc.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customers")
public class CustomerController {
    private final CustomerService service;

    public CustomerController(CustomerService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerService.CustomerResponse create(@Valid @RequestBody CustomerService.CreateCustomerRequest request,
                                                   @AuthenticationPrincipal UserAccount actor,
                                                   HttpServletRequest http) {
        return service.create(request, actor, http);
    }

    @GetMapping
    public PageResponse<CustomerService.CustomerResponse> list(
        @AuthenticationPrincipal UserAccount actor,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "createdAt") String sortBy,
        HttpServletRequest http) {
        return service.list(actor, page, size, sortBy, http);
    }

    @GetMapping("/{customerId}")
    public CustomerService.CustomerResponse get(@PathVariable String customerId,
                                                @AuthenticationPrincipal UserAccount actor,
                                                HttpServletRequest http) {
        return service.get(customerId, actor, http);
    }

    @PatchMapping("/{customerId}")
    public CustomerService.CustomerResponse update(@PathVariable String customerId,
                                                   @Valid @RequestBody CustomerService.UpdateCustomerRequest request,
                                                   @AuthenticationPrincipal UserAccount actor,
                                                   HttpServletRequest http) {
        return service.update(customerId, request, actor, http);
    }
}
