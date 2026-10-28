CREATE TABLE roles (
    id CHAR(36) NOT NULL,
    role_code VARCHAR(40) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_roles_role_code UNIQUE (role_code),
    CONSTRAINT chk_roles_role_code CHECK (
        role_code IN ('CUSTOMER', 'KYC_ANALYST', 'COMPLIANCE_SUPERVISOR', 'API_CLIENT_ADMIN')
    )
) ENGINE=InnoDB;

CREATE TABLE users (
    id CHAR(36) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    INDEX ix_users_enabled (enabled)
) ENGINE=InnoDB;

CREATE TABLE user_roles (
    user_id CHAR(36) NOT NULL,
    role_id CHAR(36) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id),
    INDEX ix_user_roles_role (role_id)
) ENGINE=InnoDB;

CREATE TABLE api_clients (
    id CHAR(36) NOT NULL,
    client_name VARCHAR(120) NOT NULL,
    credential_hash CHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_api_clients_name UNIQUE (client_name),
    CONSTRAINT uq_api_clients_credential_hash UNIQUE (credential_hash),
    INDEX ix_api_clients_enabled (enabled)
) ENGINE=InnoDB;

CREATE TABLE customers (
    id CHAR(36) NOT NULL,
    owner_user_id CHAR(36) NULL,
    display_name VARCHAR(160) NOT NULL,
    email VARCHAR(254) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_customers_owner_user UNIQUE (owner_user_id),
    CONSTRAINT fk_customers_owner_user FOREIGN KEY (owner_user_id) REFERENCES users (id),
    INDEX ix_customers_email (email),
    INDEX ix_customers_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE kyc_cases (
    id CHAR(36) NOT NULL,
    case_reference VARCHAR(32) NOT NULL,
    customer_id CHAR(36) NOT NULL,
    case_type VARCHAR(24) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    risk_level VARCHAR(16) NOT NULL,
    priority VARCHAR(16) NOT NULL,
    idempotency_key VARCHAR(128) NULL,
    created_by_user_id CHAR(36) NOT NULL,
    assigned_to_user_id CHAR(36) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_kyc_cases_reference UNIQUE (case_reference),
    CONSTRAINT uq_kyc_cases_creator_idempotency UNIQUE (created_by_user_id, idempotency_key),
    CONSTRAINT chk_kyc_cases_type CHECK (case_type IN ('INDIVIDUAL', 'BUSINESS')),
    CONSTRAINT chk_kyc_cases_status CHECK (
        status IN (
            'DRAFT',
            'IN_REVIEW',
            'PENDING_SUPERVISOR_APPROVAL',
            'APPROVED',
            'REJECTED'
        )
    ),
    CONSTRAINT chk_kyc_cases_risk CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT chk_kyc_cases_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH')),
    CONSTRAINT fk_kyc_cases_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    CONSTRAINT fk_kyc_cases_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id),
    CONSTRAINT fk_kyc_cases_assignee FOREIGN KEY (assigned_to_user_id) REFERENCES users (id),
    INDEX ix_kyc_cases_customer_created (customer_id, created_at),
    INDEX ix_kyc_cases_assignee_status (assigned_to_user_id, status),
    INDEX ix_kyc_cases_status_created (status, created_at)
) ENGINE=InnoDB;

CREATE TABLE audit_events (
    id CHAR(36) NOT NULL,
    actor_user_id CHAR(36) NULL,
    actor_role VARCHAR(40) NULL,
    event_type VARCHAR(80) NOT NULL,
    resource_type VARCHAR(40) NOT NULL,
    resource_id CHAR(36) NULL,
    outcome VARCHAR(16) NOT NULL,
    correlation_id VARCHAR(64) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT chk_audit_events_outcome CHECK (outcome IN ('SUCCESS', 'FAILURE', 'DENIED')),
    CONSTRAINT fk_audit_events_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX ix_audit_events_actor_time (actor_user_id, created_at),
    INDEX ix_audit_events_resource_time (resource_type, resource_id, created_at),
    INDEX ix_audit_events_correlation (correlation_id)
) ENGINE=InnoDB;

CREATE TABLE auth_sessions (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expires_at TIMESTAMP(6) NOT NULL,
    last_seen_at TIMESTAMP(6) NULL,
    revoked_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_auth_sessions_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX ix_auth_sessions_user_expiry (user_id, expires_at),
    INDEX ix_auth_sessions_expiry_revoked (expires_at, revoked_at)
) ENGINE=InnoDB;
