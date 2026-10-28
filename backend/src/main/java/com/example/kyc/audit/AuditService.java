package com.example.kyc.audit;

import com.example.kyc.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuditService {
    private final AuditEventRepository repository;

    public AuditService(AuditEventRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(UserAccount actor, String eventType, String resourceType,
                       String resourceId, String outcome, HttpServletRequest request) {
        repository.save(event(actor, eventType, resourceType, resourceId, outcome, request));
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void recordChange(UserAccount actor, String eventType, String resourceType,
                             String resourceId, String outcome, HttpServletRequest request) {
        repository.save(event(actor, eventType, resourceType, resourceId, outcome, request));
    }

    private AuditEvent event(UserAccount actor, String eventType, String resourceType,
                             String resourceId, String outcome, HttpServletRequest request) {
        String actorRole = actor == null ? null : actor.getRoles().stream()
            .map(role -> role.getRoleCode()).sorted().findFirst().orElse(null);
        Object correlation = request == null ? null : request.getAttribute("correlationId");
        String safeResourceId = resourceId;
        if (safeResourceId != null) {
            try {
                safeResourceId = UUID.fromString(safeResourceId).toString().equalsIgnoreCase(safeResourceId)
                    ? safeResourceId
                    : null;
            } catch (IllegalArgumentException exception) {
                safeResourceId = null;
            }
        }
        return new AuditEvent(actor, actorRole, eventType, resourceType, safeResourceId,
            outcome, correlation instanceof String value ? value : null);
    }
}
