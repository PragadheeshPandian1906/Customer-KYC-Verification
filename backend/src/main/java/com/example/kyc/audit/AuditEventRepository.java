package com.example.kyc.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AuditEventRepository extends JpaRepository<AuditEvent, String>,
    JpaSpecificationExecutor<AuditEvent> {
}
