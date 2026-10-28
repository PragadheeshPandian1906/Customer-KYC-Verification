ALTER TABLE kyc_cases
    DROP CHECK chk_kyc_cases_status;

ALTER TABLE kyc_cases
    ADD CONSTRAINT chk_kyc_cases_status CHECK (
        status IN (
            'DRAFT',
            'IN_REVIEW',
            'PENDING_SUPERVISOR_APPROVAL',
            'APPROVED',
            'REJECTED',
            'NEEDS_INFORMATION',
            'CLOSED'
        )
    );

CREATE TABLE verification_checks (
    id CHAR(36) NOT NULL,
    case_id CHAR(36) NOT NULL,
    document_id CHAR(36) NULL,
    check_type VARCHAR(60) NOT NULL,
    result VARCHAR(24) NOT NULL,
    notes VARCHAR(500) NULL,
    performed_by_user_id CHAR(36) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT chk_verification_checks_result CHECK (
        result IN ('PASS', 'FAIL', 'NEEDS_INFORMATION', 'NOT_APPLICABLE')
    ),
    CONSTRAINT fk_verification_checks_case FOREIGN KEY (case_id) REFERENCES kyc_cases (id),
    CONSTRAINT fk_verification_checks_document FOREIGN KEY (document_id) REFERENCES kyc_documents (id),
    CONSTRAINT fk_verification_checks_performer FOREIGN KEY (performed_by_user_id) REFERENCES users (id),
    INDEX ix_verification_checks_case_type_created (case_id, check_type, created_at),
    INDEX ix_verification_checks_document (document_id)
) ENGINE=InnoDB;

CREATE TABLE verification_decisions (
    id CHAR(36) NOT NULL,
    case_id CHAR(36) NOT NULL,
    submitted_by_user_id CHAR(36) NOT NULL,
    outcome VARCHAR(24) NOT NULL,
    reason_code VARCHAR(60) NOT NULL,
    rationale VARCHAR(1000) NULL,
    approval_required BOOLEAN NOT NULL,
    idempotency_key VARCHAR(128) NULL,
    request_fingerprint CHAR(64) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_verification_decisions_idempotency UNIQUE (case_id, submitted_by_user_id, idempotency_key),
    CONSTRAINT chk_verification_decisions_outcome CHECK (
        outcome IN ('APPROVE', 'REJECT', 'NEEDS_INFORMATION')
    ),
    CONSTRAINT chk_verification_decisions_approval CHECK (
        (outcome = 'APPROVE' AND approval_required IN (TRUE, FALSE))
        OR (outcome IN ('REJECT', 'NEEDS_INFORMATION') AND approval_required = FALSE)
    ),
    CONSTRAINT fk_verification_decisions_case FOREIGN KEY (case_id) REFERENCES kyc_cases (id),
    CONSTRAINT fk_verification_decisions_submitter FOREIGN KEY (submitted_by_user_id) REFERENCES users (id),
    INDEX ix_verification_decisions_case_created (case_id, created_at),
    INDEX ix_verification_decisions_pending (approval_required, created_at)
) ENGINE=InnoDB;

CREATE TABLE supervisor_approvals (
    id CHAR(36) NOT NULL,
    decision_id CHAR(36) NOT NULL,
    reviewed_by_user_id CHAR(36) NOT NULL,
    outcome VARCHAR(16) NOT NULL,
    reason VARCHAR(1000) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_supervisor_approvals_decision UNIQUE (decision_id),
    CONSTRAINT chk_supervisor_approvals_outcome CHECK (outcome IN ('APPROVED', 'REJECTED')),
    CONSTRAINT fk_supervisor_approvals_decision FOREIGN KEY (decision_id) REFERENCES verification_decisions (id),
    CONSTRAINT fk_supervisor_approvals_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users (id),
    INDEX ix_supervisor_approvals_reviewer_created (reviewed_by_user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE case_status_history (
    id CHAR(36) NOT NULL,
    case_id CHAR(36) NOT NULL,
    from_status VARCHAR(32) NOT NULL,
    to_status VARCHAR(32) NOT NULL,
    changed_by_user_id CHAR(36) NOT NULL,
    reason_code VARCHAR(60) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT chk_case_status_history_from CHECK (
        from_status IN ('DRAFT', 'IN_REVIEW', 'PENDING_SUPERVISOR_APPROVAL', 'APPROVED',
                        'REJECTED', 'NEEDS_INFORMATION', 'CLOSED')
    ),
    CONSTRAINT chk_case_status_history_to CHECK (
        to_status IN ('DRAFT', 'IN_REVIEW', 'PENDING_SUPERVISOR_APPROVAL', 'APPROVED',
                      'REJECTED', 'NEEDS_INFORMATION', 'CLOSED')
    ),
    CONSTRAINT fk_case_status_history_case FOREIGN KEY (case_id) REFERENCES kyc_cases (id),
    CONSTRAINT fk_case_status_history_actor FOREIGN KEY (changed_by_user_id) REFERENCES users (id),
    INDEX ix_case_status_history_case_time (case_id, created_at)
) ENGINE=InnoDB;
