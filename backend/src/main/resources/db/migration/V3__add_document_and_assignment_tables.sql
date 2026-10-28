CREATE TABLE kyc_documents (
    id CHAR(36) NOT NULL,
    case_id CHAR(36) NOT NULL,
    document_type VARCHAR(40) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING_REVIEW',
    current_version INT NOT NULL,
    idempotency_key VARCHAR(128) NULL,
    request_fingerprint CHAR(64) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_by_user_id CHAR(36) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_kyc_documents_case_idempotency UNIQUE (case_id, idempotency_key),
    CONSTRAINT chk_kyc_documents_status CHECK (status IN ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED')),
    CONSTRAINT fk_kyc_documents_case FOREIGN KEY (case_id) REFERENCES kyc_cases (id),
    CONSTRAINT fk_kyc_documents_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id),
    INDEX ix_kyc_documents_case_created (case_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE document_versions (
    id CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    version_number INT NOT NULL,
    idempotency_key VARCHAR(128) NULL,
    request_fingerprint CHAR(64) NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    storage_key CHAR(36) NOT NULL,
    uploaded_by_user_id CHAR(36) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_document_versions_number UNIQUE (document_id, version_number),
    CONSTRAINT uq_document_versions_idempotency UNIQUE (document_id, idempotency_key),
    CONSTRAINT uq_document_versions_storage_key UNIQUE (storage_key),
    CONSTRAINT chk_document_versions_size CHECK (file_size > 0),
    CONSTRAINT fk_document_versions_document FOREIGN KEY (document_id) REFERENCES kyc_documents (id),
    CONSTRAINT fk_document_versions_uploader FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id),
    INDEX ix_document_versions_document_created (document_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE case_assignments (
    id CHAR(36) NOT NULL,
    case_id CHAR(36) NOT NULL,
    analyst_user_id CHAR(36) NOT NULL,
    assigned_by_user_id CHAR(36) NOT NULL,
    assigned_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ended_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_case_assignments_case FOREIGN KEY (case_id) REFERENCES kyc_cases (id),
    CONSTRAINT fk_case_assignments_analyst FOREIGN KEY (analyst_user_id) REFERENCES users (id),
    CONSTRAINT fk_case_assignments_assigner FOREIGN KEY (assigned_by_user_id) REFERENCES users (id),
    INDEX ix_case_assignments_case_active (case_id, ended_at, assigned_at),
    INDEX ix_case_assignments_analyst_active (analyst_user_id, ended_at)
) ENGINE=InnoDB;
