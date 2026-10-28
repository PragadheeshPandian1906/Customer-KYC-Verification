ALTER TABLE verification_decisions
    DROP CHECK chk_verification_decisions_approval;

ALTER TABLE verification_decisions
    ADD CONSTRAINT chk_verification_decisions_approval CHECK (
        (outcome IN ('APPROVE', 'REJECT') AND approval_required IN (TRUE, FALSE))
        OR (outcome = 'NEEDS_INFORMATION' AND approval_required = FALSE)
    );
