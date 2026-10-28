# Phase 3 Completion Report

## Summary

Phase 3 verification and supervisor-approval workflow is implemented and its regression suite passes. The implementation preserves the existing API and workflow status values. This report distinguishes established project behavior from requirements explicitly stated in the SRS.

## Work completed

### Workflow and policy

- Preserved the existing verification-check, decision-submission, additional-information, supervisor-review, case-status, closure, authorization, audit, and status-history workflow.
- Preserved the existing checks and document readiness gates for APPROVE and REJECT decisions.
- Configured both APPROVE and REJECT decisions on HIGH-risk cases to require supervisor review. NEEDS_INFORMATION does not require supervisor approval.
- Confirmed the SRS requirement: supervisor approval is required for configured high-risk outcomes. The SRS does not enumerate those outcomes; requiring it for both APPROVE and REJECT is the project policy selected for this implementation.
- A supervisor approval finalizes the submitted recommendation. A supervisor rejection of the recommendation returns the case to IN_REVIEW. A decision submitter cannot approve their own decision.
- Preserved the existing workflow endpoints and statuses; no alternative status names were introduced.

### Database and runtime

- Added the additive Flyway migration `V5__allow_supervisor_approval_for_rejections.sql`. It permits approval-required REJECT decisions while keeping NEEDS_INFORMATION non-approvable. Applied migration V4 was not edited.
- Updated `backend/run-local.ps1` to select Java 21 from configured or standard Windows JDK locations and to fail clearly if Java 21 cannot be found.
- Updated the README and Phase 2 API guide with the selected Phase 3 approval policy, SRS caveat, setup, and migration details.

## Automated regression coverage

The workflow API tests cover high-risk approval and rejection paths, additional-information resumption, duplicate/idempotent submissions, conflicting approvals, attempts at self-approval, status history, and closure preconditions. Existing authentication/authorization, document management, and assignment tests were retained.

**Validation run:** `mvn test` using Java 21.0.12.1.

**Result:** 24 tests passed; 0 failures, 0 errors, 0 skipped.

The test profile uses H2 with Flyway disabled. These tests do not independently verify MySQL migration behavior.

## MySQL and local application verification

- Started the local backend using `backend/run-local.ps1`; the script selected the installed Java 21 JDK.
- Flyway validated all five migrations and confirmed MySQL schema version 5.
- Hibernate initialized successfully against MySQL 8.0.46.
- Spring Boot started on port 8080.
- `GET /api/v1/auth/csrf` returned HTTP 200.

The migration was applied to the existing development database, which was already at version 4. No database or application data was dropped. A clean-database migration run and full workflow exercise against live MySQL were not performed.

## Files changed for Phase 3

- `backend/src/main/resources/db/migration/V5__allow_supervisor_approval_for_rejections.sql` — additive decision-constraint update.
- `backend/src/test/java/com/example/kyc/document/DocumentAssignmentApiTest.java` — regression coverage for high-risk REJECT supervisor approval.
- `backend/run-local.ps1` — Java 21 selection for local startup.
- `docs/phase2-api-guide.md` — documented Phase 3 workflow and the configured high-risk policy.
- `README.md` — setup, SRS interpretation, Java 21, and V5 migration information.
- `docs/phase3-completion-report.md` — this completion report.

## Remaining verification and decisions

- The SRS permits configuring high-risk outcomes but does not state which outcomes require approval. The project currently configures both APPROVE and REJECT; confirm this policy with stakeholders if a formal business decision is required.
- Verification catalogue entries, required document types, and the submitter-not-approver rule are project defaults/policy, not requirements specified by the SRS.
- Run migration validation against a clean development database and exercise the complete workflow against MySQL.
- Add MySQL-backed integration coverage for database constraints, transaction behavior, and concurrency-sensitive operations.

## Completion status

**Partially complete.** The Phase 3 workflow policy fix, additive migration, regression tests, documentation updates, Java 21 local startup, migration validation against the existing MySQL development database, and basic live endpoint check are complete. Clean-database and full live-MySQL workflow acceptance checks remain outstanding.
