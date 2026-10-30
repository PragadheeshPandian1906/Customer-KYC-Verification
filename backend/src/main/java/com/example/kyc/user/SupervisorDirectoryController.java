package com.example.kyc.user;

import com.example.kyc.common.ApiException;
import com.example.kyc.common.PageResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supervisor/analysts")
@PreAuthorize("hasRole('COMPLIANCE_SUPERVISOR')")
public class SupervisorDirectoryController {
    private final UserRepository users;

    public SupervisorDirectoryController(UserRepository users) {
        this.users = users;
    }

    @GetMapping
    public PageResponse<AnalystSummary> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String search) {
        if (page < 0 || size < 1 || size > 100 || (search != null && search.length() > 120)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid analyst directory query");
        }
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim();
        return PageResponse.from(users.findActiveAnalysts(normalizedSearch,
            PageRequest.of(page, size, Sort.by(Sort.Order.asc("displayName"), Sort.Order.asc("id"))))
            .map(user -> new AnalystSummary(user.getId(), user.getDisplayName())));
    }

    public record AnalystSummary(String id, String displayName) {
    }
}
