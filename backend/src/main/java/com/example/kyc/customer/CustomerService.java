package com.example.kyc.customer;

import com.example.kyc.audit.AuditService;
import com.example.kyc.common.ApiException;
import com.example.kyc.common.PageResponse;
import com.example.kyc.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerService {
    private final CustomerRepository customers;
    private final AuditService audit;

    public CustomerService(CustomerRepository customers, AuditService audit) {
        this.customers = customers;
        this.audit = audit;
    }

    @Transactional
    public CustomerResponse create(CreateCustomerRequest request, UserAccount actor, HttpServletRequest http) {
        boolean selfService = actor.hasRole("CUSTOMER");
        if (!selfService && !staff(actor)) {
            throw forbidden();
        }
        Customer customer = customers.save(new Customer(selfService ? actor : null,
            selfService ? actor.getDisplayName() : request.displayName(),
            selfService ? actor.getEmail() : request.email()));
        audit.recordChange(actor, "CUSTOMER_CREATED", "CUSTOMER", customer.getId(), "SUCCESS", http);
        return CustomerResponse.from(customer);
    }

    @Transactional(readOnly = true)
    public PageResponse<CustomerResponse> list(UserAccount actor, int page, int size, String sortBy,
                                               HttpServletRequest http) {
        validatePage(page, size, sortBy);
        PageRequest pageable = PageRequest.of(page, size, Sort.by(sortBy).ascending());
        Page<Customer> result;
        if (actor.hasRole("CUSTOMER")) {
            result = customers.findAllByOwner_Id(actor.getId(), pageable);
        } else if (actor.hasRole("COMPLIANCE_SUPERVISOR")) {
            result = customers.findAll(pageable);
        } else if (actor.hasRole("KYC_ANALYST")) {
            result = customers.findAllAssignedToAnalyst(actor.getId(), pageable);
        } else {
            audit.record(actor, "CUSTOMER_LIST", "CUSTOMER", null, "DENIED", http);
            throw forbidden();
        }
        audit.record(actor, "CUSTOMER_LIST", "CUSTOMER", null, "SUCCESS", http);
        return PageResponse.from(result.map(CustomerResponse::from));
    }

    @Transactional(readOnly = true)
    public CustomerResponse get(String id, UserAccount actor, HttpServletRequest http) {
        Customer customer = customers.findById(id).orElseThrow(CustomerService::notFound);
        if (!canAccess(customer, actor)) {
            audit.record(actor, "CUSTOMER_READ", "CUSTOMER", id, "DENIED", http);
            throw notFound();
        }
        audit.record(actor, "CUSTOMER_READ", "CUSTOMER", id, "SUCCESS", http);
        return CustomerResponse.from(customer);
    }

    @Transactional
    public CustomerResponse update(String id, UpdateCustomerRequest request, UserAccount actor,
                                   HttpServletRequest http) {
        Customer customer = customers.findById(id).orElseThrow(CustomerService::notFound);
        if (!canAccess(customer, actor)) {
            audit.record(actor, "CUSTOMER_UPDATE", "CUSTOMER", id, "DENIED", http);
            throw notFound();
        }
        if (!actor.hasRole("CUSTOMER") && !staff(actor)) {
            throw forbidden();
        }
        customer.update(request.displayName(), request.email());
        audit.recordChange(actor, "CUSTOMER_UPDATED", "CUSTOMER", customer.getId(), "SUCCESS", http);
        return CustomerResponse.from(customer);
    }

    private boolean canAccess(Customer customer, UserAccount actor) {
        return actor.hasRole("CUSTOMER")
            ? customer.getOwner() != null && customer.getOwner().getId().equals(actor.getId())
            : actor.hasRole("COMPLIANCE_SUPERVISOR")
                || (actor.hasRole("KYC_ANALYST")
                    && customers.existsByIdAndKycCases_AssignedTo_Id(customer.getId(), actor.getId()));
    }

    private boolean staff(UserAccount user) {
        return user.hasRole("KYC_ANALYST") || user.hasRole("COMPLIANCE_SUPERVISOR");
    }

    private void validatePage(int page, int size, String sortBy) {
        if (page < 0 || size < 1 || size > 100
            || !java.util.Set.of("createdAt", "displayName", "email").contains(sortBy)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid pagination or sort parameter");
        }
    }

    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "This operation is not permitted");
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Customer not found");
    }

    public record CreateCustomerRequest(
        @jakarta.validation.constraints.NotBlank
        @jakarta.validation.constraints.Size(max = 160) String displayName,
        @jakarta.validation.constraints.NotBlank
        @jakarta.validation.constraints.Email
        @jakarta.validation.constraints.Size(max = 254) String email) {
    }

    public record UpdateCustomerRequest(
        @jakarta.validation.constraints.Size(min = 1, max = 160) String displayName,
        @jakarta.validation.constraints.Email
        @jakarta.validation.constraints.Size(max = 254) String email) {
        @jakarta.validation.constraints.AssertTrue(message = "At least one customer field must be provided")
        public boolean isValid() {
            return displayName != null || email != null;
        }
    }

    public record CustomerResponse(String id, String displayName, String email,
                                   java.time.Instant createdAt, java.time.Instant updatedAt) {
        static CustomerResponse from(Customer customer) {
            return new CustomerResponse(customer.getId(), customer.getDisplayName(), customer.getEmail(),
                customer.getCreatedAt(), customer.getUpdatedAt());
        }
    }
}
