package com.example.kyc.audit;

import com.example.kyc.common.ApiException;
import com.example.kyc.common.PageResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/audit-events")
@PreAuthorize("hasRole('API_CLIENT_ADMIN')")
public class AdminAuditController {
    private final AuditEventRepository events;

    public AdminAuditController(AuditEventRepository events) {
        this.events = events;
    }

    @GetMapping
    public PageResponse<AuditEventResponse> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size,
        @RequestParam(required = false) String eventType,
        @RequestParam(required = false) String resourceType,
        @RequestParam(required = false) String outcome,
        @RequestParam(required = false) String actorUserId) {
        if (page < 0 || size < 1 || size > 100 || tooLong(eventType, 80)
            || tooLong(resourceType, 40) || tooLong(outcome, 16) || tooLong(actorUserId, 36)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid audit event query");
        }
        Specification<AuditEvent> filters = Specification.where(null);
        if (present(eventType)) {
            filters = filters.and((root, query, builder) ->
                builder.equal(root.get("eventType"), eventType.trim()));
        }
        if (present(resourceType)) {
            filters = filters.and((root, query, builder) ->
                builder.equal(root.get("resourceType"), resourceType.trim()));
        }
        if (present(outcome)) {
            filters = filters.and((root, query, builder) ->
                builder.equal(root.get("outcome"), outcome.trim()));
        }
        if (present(actorUserId)) {
            filters = filters.and((root, query, builder) ->
                builder.equal(root.get("actor").get("id"), actorUserId.trim()));
        }
        return PageResponse.from(events.findAll(filters,
            PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))))
            .map(AuditEventResponse::from));
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    private static boolean tooLong(String value, int maximum) {
        return value != null && value.length() > maximum;
    }

    public record AuditEventResponse(String id, String actorUserId, String actorRole,
                                     String eventType, String resourceType, String resourceId,
                                     String outcome, java.time.Instant createdAt) {
        static AuditEventResponse from(AuditEvent event) {
            return new AuditEventResponse(event.getId(),
                event.getActor() == null ? null : event.getActor().getId(),
                event.getActorRole(), event.getEventType(), event.getResourceType(),
                event.getResourceId(), event.getOutcome(), event.getCreatedAt());
        }
    }
}
