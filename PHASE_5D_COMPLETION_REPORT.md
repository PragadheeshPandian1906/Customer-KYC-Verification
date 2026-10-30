# Phase 5D Implementation and Validation Report

## Status

**Implementation complete; release acceptance remains incomplete.** The Phase 5D backend/frontend features and regression tests in scope are implemented. Subsequent Phase 5E checks verified the configured local MySQL history/schema and live backend availability, but authenticated end-to-end workflows remain blocked by the local login rate limiter. See the [Phase 5E acceptance report](./docs/phase5e-acceptance-report.md) for current evidence and blockers.

No `.env` values were displayed or changed. No database was created, reset, dropped, or repaired.

## Implemented

### CSRF contract and mutation retry safety

- The frontend stores and uses both `headerName` and `token` returned by `GET /api/v1/auth/csrf`; it no longer assumes the header name.
- The backend marks CSRF filter failures with `code: "CSRF_INVALID"`.
- A mutation is refreshed and retried at most once only after that explicit pre-controller CSRF rejection. Ordinary authorization `403` responses are not retried.
- Spring method-security access denials now return a proper 403 problem response instead of falling through to the generic 500 handler.

### Supervisor analyst directory

- Added `GET /api/v1/supervisor/analysts?page=0&size=20&search=...`, restricted to `COMPLIANCE_SUPERVISOR`.
- Results are paginated and contain only analyst ID and display name for enabled `KYC_ANALYST` accounts.
- Assignment UI now searches/selects from that directory rather than requiring a manually typed UUID. It supports paging, retry, and visible load/error/empty states.
- Case and assignment history responses include additive analyst display-name fields while retaining existing IDs.

### Additional-information responses

- Existing analyst `NEEDS_INFORMATION` decisions now also create linked information-request records using the decision rationale. No replacement status or separate decision workflow was introduced.
- Added `GET /api/v1/kyc/cases/{caseId}/communications` for the case owner, assigned analyst, or supervisor.
- Added `POST /api/v1/kyc/cases/{caseId}/communications/responses` for the owning customer while the case is `NEEDS_INFORMATION`.
- Responses must identify an unanswered request. Optional document references are limited to unique documents on the same case. Database constraints also enforce the request/response relationship and same-case parent link.
- Communications are append-only through the API. A customer response does not change case status; the assigned staff member continues through the existing review/resume operation.
- The case page displays the communication history and lets customers submit a response with references to documents already uploaded to that case.

### Admin audit-event browser

- Added read-only `GET /api/v1/admin/audit-events`, restricted to `API_CLIENT_ADMIN`.
- Supports pagination and exact `eventType`, `resourceType`, `outcome`, and `actorUserId` filters.
- The response excludes correlation IDs, credentials, document content, and customer contact details.
- Added an admin-only page and navigation entry.

### Additive migration and documentation

- Added Flyway V6 to store information requests/responses and same-case document references. Existing migrations V1-V5 were not edited.
- Updated `docs/phase2-api-guide.md` with the backend-provided CSRF header contract, new endpoints, roles, payloads, response behavior, and error cases.

## Files changed for Phase 5D

### Backend

- `backend/src/main/java/com/example/kyc/security/SecurityConfiguration.java` - CSRF failure marker and safe access-denial handling.
- `backend/src/main/java/com/example/kyc/common/ApiExceptionHandler.java` - map method-security denials to 403.
- `backend/src/main/java/com/example/kyc/user/UserRepository.java`, `backend/src/main/java/com/example/kyc/user/SupervisorDirectoryController.java` - active analyst query and supervisor directory endpoint.
- `backend/src/main/java/com/example/kyc/kyc/KycCaseService.java`, `backend/src/main/java/com/example/kyc/kyc/VerificationWorkflowService.java` - display-name response fields and information-request creation within the existing decision workflow.
- `backend/src/main/java/com/example/kyc/kyc/CaseCommunication.java`, `CaseCommunicationRepository.java`, `CaseCommunicationService.java`, `CaseCommunicationController.java` - communication persistence, authorization, validation, auditing, and API.
- `backend/src/main/java/com/example/kyc/audit/AuditEvent.java`, `AuditEventRepository.java`, `AdminAuditController.java` - minimal paginated audit-event browsing.
- `backend/src/main/resources/db/migration/V6__add_case_communications.sql` - additive communications schema.
- `backend/src/test/java/com/example/kyc/auth/AuthAndAuthorizationApiTest.java` - valid/missing/invalid CSRF behavior and role-gated directory/audit tests.
- `backend/src/test/java/com/example/kyc/document/DocumentAssignmentApiTest.java` - end-to-end MockMvc customer response, same-case document validation, duplicate response, status, and audit checks.

### Frontend

- `frontend/src/lib/api/csrf.ts`, `frontend/src/lib/api/client.ts` - use server-provided CSRF header and retry only explicit CSRF rejection.
- `frontend/src/features/cases/AssignCaseModal.tsx`, `frontend/src/types/case.ts` - directory search/selection and analyst display names.
- `frontend/src/features/cases/CaseCommunicationsTab.tsx`, `frontend/src/features/cases/CaseDetailPage.tsx` - customer response and communication history.
- `frontend/src/features/audit/AuditEventsPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/shared/Sidebar.tsx` - admin-only audit page and navigation.
- `frontend/src/tests/csrf.test.ts`, `frontend/src/tests/phase5d.test.tsx` - CSRF retry boundary, directory assignment, customer response payload, and audit filters.

The previously completed Phase 5B changes remain present; they were not rebuilt or replaced as part of this work.

## Validation results

| Check | Result | Evidence / limitation |
|---|---|---|
| Backend full verification | **PASS** | `mvn -q verify`; 30 tests in 10 suites, 0 failures, 0 errors, 0 skipped. Java 21. |
| Backend test database | **PASS, H2 only** | MockMvc/API tests run using the test profile and H2. This does not validate MySQL migrations or MySQL behavior. |
| Frontend lint/typecheck | **PASS** | `npm run lint` (`tsc --noEmit`). |
| Frontend tests | **PASS** | `npm test`; 9 test files, 31 tests passed. React Router future-flag and existing `act(...)` warnings were non-failing. |
| Frontend production build | **PASS** | `npm run build`; TypeScript and Vite production build succeeded. |
| Patch whitespace check | **PASS** | `git diff --check`. |
| Live backend HTTP | **PASS, basic reachability** | The backend remained active on port 8080; `GET /api/v1/auth/csrf` returned 200 before and after the regression run. |
| MySQL availability | **PASS** | A read-only JDBC connection to the configured local database succeeded. No separate schema was created. |
| V1-V6 Flyway history and V6 schema | **PASS, local database** | All six history rows are successful; stored checksums and V6 columns, foreign keys, indexes, and constraints are recorded in the [Phase 5E acceptance report](./docs/phase5e-acceptance-report.md). The application initialized with Flyway enabled and Hibernate schema validation. |
| Authenticated live HTTP workflow | **BLOCKED** | Local account login succeeded, but subsequent attempts reached HTTP 429. Full workflow endpoints and browser-authenticated role navigation remain unverified; H2 MockMvc tests are not MySQL acceptance evidence. |
| Production-profile runtime/deployment controls | **NOT RUN** | TLS/proxy, secure-cookie deployment, production startup, backups, and key recovery/rotation require a controlled target environment. |

## Remaining work and blockers

1. After the configured login rate-limit window has elapsed, complete authenticated HTTP and browser acceptance for each role, including assignment, upload/download, decision and approval paths, information requests/responses, audit browsing, and cross-case denial. Track each result in the [Phase 5E acceptance report](./docs/phase5e-acceptance-report.md).
2. Validate production-profile and deployment controls in the actual controlled environment. These are not established by the H2 tests or local static review.

The project remains **not ready for release** until the authenticated live acceptance and controlled production-profile checks are evidenced.

## Worktree note

The pre-existing change to `docs/phase4-security-and-release-report.md` was visible in the worktree and was not modified for this task. No commit, push, tag, or release was performed.
