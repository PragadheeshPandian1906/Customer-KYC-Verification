package com.example.kyc.audit;

import com.example.kyc.user.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_events")
public class AuditEvent {
    @Id
    @Column(length = 36, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_user_id")
    private UserAccount actor;

    @Column(name = "actor_role", length = 40)
    private String actorRole;

    @Column(name = "event_type", nullable = false, length = 80)
    private String eventType;

    @Column(name = "resource_type", nullable = false, length = 40)
    private String resourceType;

    @Column(name = "resource_id", length = 36, columnDefinition = "CHAR(36)")
    private String resourceId;

    @Column(nullable = false, length = 16)
    private String outcome;

    @Column(name = "correlation_id", length = 64)
    private String correlationId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected AuditEvent() {
    }

    public AuditEvent(UserAccount actor, String actorRole, String eventType, String resourceType,
                      String resourceId, String outcome, String correlationId) {
        this.actor = actor;
        this.actorRole = actorRole;
        this.eventType = eventType;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.outcome = outcome;
        this.correlationId = correlationId;
    }
}
