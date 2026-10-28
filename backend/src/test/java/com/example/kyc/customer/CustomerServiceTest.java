package com.example.kyc.customer;

import com.example.kyc.audit.AuditService;
import com.example.kyc.common.ApiException;
import com.example.kyc.role.Role;
import com.example.kyc.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomerServiceTest {
    @Test
    void customerCannotReadAnotherCustomersRecord() {
        CustomerRepository customers = mock(CustomerRepository.class);
        AuditService audit = mock(AuditService.class);
        UserAccount owner = new UserAccount("owner@example.test", "hash", "Fictional Owner",
            Set.of(new Role("CUSTOMER")));
        UserAccount other = new UserAccount("other@example.test", "hash", "Fictional Other",
            Set.of(new Role("CUSTOMER")));
        Customer record = new Customer(owner, "Fictional Owner", "owner@example.test");
        when(customers.findById("customer-id")).thenReturn(Optional.of(record));
        CustomerService service = new CustomerService(customers, audit);

        ApiException exception = assertThrows(ApiException.class,
            () -> service.get("customer-id", other, mock(HttpServletRequest.class)));

        assertEquals(404, exception.getStatus().value());
        verify(audit).record(any(), org.mockito.ArgumentMatchers.eq("CUSTOMER_READ"),
            org.mockito.ArgumentMatchers.eq("CUSTOMER"), org.mockito.ArgumentMatchers.eq("customer-id"),
            org.mockito.ArgumentMatchers.eq("DENIED"), any());
    }

    @Test
    void customerSelfServiceUsesAuthenticatedIdentityInsteadOfSubmittedOwnerFields() {
        CustomerRepository customers = mock(CustomerRepository.class);
        AuditService audit = mock(AuditService.class);
        UserAccount actor = new UserAccount("customer@example.test", "hash", "Fictional Account",
            Set.of(new Role("CUSTOMER")));
        when(customers.save(any(Customer.class))).thenAnswer(invocation -> invocation.getArgument(0));
        CustomerService service = new CustomerService(customers, audit);

        service.create(new CustomerService.CreateCustomerRequest("Untrusted Name", "attacker@example.test"),
            actor, mock(HttpServletRequest.class));

        var saved = org.mockito.ArgumentCaptor.forClass(Customer.class);
        verify(customers).save(saved.capture());
        assertEquals(actor.getEmail(), saved.getValue().getEmail());
        assertEquals(actor.getDisplayName(), saved.getValue().getDisplayName());
        assertEquals(actor.getId(), saved.getValue().getOwner().getId());
    }
}
