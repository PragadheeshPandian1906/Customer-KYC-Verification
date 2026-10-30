CREATE TABLE case_communications (
    id CHAR(36) NOT NULL,
    case_id CHAR(36) NOT NULL,
    sender_user_id CHAR(36) NOT NULL,
    sender_role VARCHAR(40) NOT NULL,
    communication_type VARCHAR(16) NOT NULL,
    parent_communication_id CHAR(36) NULL,
    source_decision_id CHAR(36) NULL,
    message VARCHAR(2000) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_case_communications_case FOREIGN KEY (case_id) REFERENCES kyc_cases(id),
    CONSTRAINT fk_case_communications_sender FOREIGN KEY (sender_user_id) REFERENCES users(id),
    CONSTRAINT fk_case_communications_parent FOREIGN KEY (parent_communication_id)
        REFERENCES case_communications(id),
    CONSTRAINT uq_case_communications_id_case UNIQUE (id, case_id),
    CONSTRAINT fk_case_communications_parent_case FOREIGN KEY (parent_communication_id, case_id)
        REFERENCES case_communications(id, case_id),
    CONSTRAINT fk_case_communications_decision FOREIGN KEY (source_decision_id)
        REFERENCES verification_decisions(id),
    CONSTRAINT uq_case_communications_parent UNIQUE (parent_communication_id),
    CONSTRAINT chk_case_communications_type CHECK (communication_type IN ('INFORMATION_REQUEST', 'CUSTOMER_RESPONSE')),
    CONSTRAINT chk_case_communications_message CHECK (CHAR_LENGTH(TRIM(message)) BETWEEN 1 AND 2000),
    CONSTRAINT chk_case_communications_links CHECK (
        (communication_type = 'INFORMATION_REQUEST' AND parent_communication_id IS NULL
            AND source_decision_id IS NOT NULL)
        OR (communication_type = 'CUSTOMER_RESPONSE' AND parent_communication_id IS NOT NULL
            AND source_decision_id IS NULL)
    ),
    INDEX idx_case_communications_case_created (case_id, created_at),
    INDEX idx_case_communications_parent (parent_communication_id)
);

CREATE TABLE case_communication_documents (
    communication_id CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    PRIMARY KEY (communication_id, document_id),
    CONSTRAINT fk_communication_documents_communication FOREIGN KEY (communication_id)
        REFERENCES case_communications(id),
    CONSTRAINT fk_communication_documents_document FOREIGN KEY (document_id)
        REFERENCES kyc_documents(id)
);
