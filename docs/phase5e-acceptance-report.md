# Phase 5E Live Acceptance Report

## Final status: NOT READY

The configured local backend and MySQL database are available, Flyway V1–V7 are recorded as successful, and the automated regression suites pass. Guided authenticated browser testing completed the high-risk rejection, separate supervisor review, case closure, admin audit filtering, customer profile/case creation, and customer ownership-denial paths using fictional accounts and synthetic data.

The first live customer information-request attempt exposed a release-blocking width defect: `INFORMATION_REQUEST` (19 characters) and `CUSTOMER_RESPONSE` (17) could not fit the original MySQL `VARCHAR(16)` column. That transaction rolled back, leaving the customer-owned case in `IN_REVIEW` with no decision or communication rows. After authorization, the JPA mapping was widened to 32 and additive Flyway V7 was applied successfully; the application restarted and Hibernate schema validation passed. The guided post-fix browser workflow then succeeded through customer response and analyst resume.

## Evidence summary

| Check | Status | Evidence |
|---|---|---|
| Backend listener and CSRF endpoint | **PASSED** | Java process remained on port 8080; `GET /api/v1/auth/csrf` returned 200 before and after the Maven verification run. |
| Local authentication | **PASSED** | Customer, analyst, supervisor, and admin fictional accounts signed in through the browser. Supervisor, analyst, and customer roles were used in workflow screens; admin accessed the admin-only audit page. Earlier rate-limit responses are resolved. |
| Invalid CSRF rejection | **PASSED** | One mutation with an invalid token returned 403 with `code: CSRF_INVALID`. The acceptance client made one request and did not retry. |
| Supervisor analyst directory and assignment | **PASSED** | Browser directory loaded the active fictional analyst; supervisor assigned that analyst to both synthetic cases. |
| Flyway V1–V7 history | **PASSED** | Before V7, read-only MySQL inspection confirmed V1–V6 successful and zero failed rows. The Flyway-enabled restart reported `Successfully applied 1 migration ... now at version v7`; startup completed without checksum or migration errors. |
| Recorded Flyway checksums | **BLOCKED** | Previously read checksums: V1 `-1686350257`, V2 `293534251`, V3 `1518908423`, V4 `-277840470`, V5 `-1897506717`, V6 `-1256540301`. Flyway accepted existing migration history and applied V7; V7's recorded checksum was not independently queried. |
| Pending migrations | **PASSED** | The Flyway-enabled application applied V7, then started at version 7. |
| JPA/schema initialization | **PASSED** | After V7, the running application initialized with Hibernate schema validation and `GET /api/v1/auth/csrf` returned 200. |
| Communication tables, constraints, and V7 width migration | **PASSED** | Earlier read-only `information_schema` checks confirmed the V6 communication tables, keys, foreign keys, checks, and indexes. Startup successfully applied V7 widening `communication_type` to `VARCHAR(32)`; the post-fix request and response also succeeded in the browser. Direct post-fix SQL inspection was not performed. |
| Customer profile and case creation | **PASSED** | Supervisor registered a fictional synthetic customer and created a HIGH-risk case. The customer account then linked its own profile and created a separate LOW-risk case. |
| Customer ownership denial | **PASSED** | While authenticated as the customer who owns the LOW-risk case, opening the supervisor-created HIGH-risk case returned 404 and the UI showed “Unable to Load Case.” |
| Synthetic document upload and review | **PASSED** | Analyst uploaded a user-confirmed synthetic image as `IDENTITY_EVIDENCE`; it appeared as Pending Review and was deliberately rejected as placeholder evidence. No real identity verification was represented. |
| Authorized document retrieval | **PASSED** | As the assigned analyst, the user downloaded the synthetic document from the closed HIGH-risk case through the normal document action. |
| High-risk analyst rejection and supervisor approval | **PASSED** | Analyst started review, recorded three explicitly synthetic checks, rejected the placeholder evidence, and submitted `REJECT` with reason `SYNTHETIC_EVIDENCE_REJECTED`. Case entered `PENDING_SUPERVISOR_APPROVAL`. A separate supervisor endorsed the recommendation, finalizing the case as `REJECTED`. |
| Case closure and status history | **PASSED** | Supervisor closed the `REJECTED` synthetic case. Workspace showed `CLOSED` and status-history count increased to four transitions. |
| High-risk approval recommendation / final APPROVED case | **BLOCKED - INVESTIGATE APPROVER IDENTITY** | On the new synthetic HIGH-risk case, the user confirmed the analyst recommendation reached `PENDING_SUPERVISOR_APPROVAL`, then reported that only the decision-submitter account was available, approved it, and observed `APPROVED`. The UI observation does not establish which authenticated user ID was recorded as approver. |
| Supervisor rejection of recommendation / return to review | **NOT TESTED** | The supervisor endorsed the analyst's rejection; the “return to IN_REVIEW” action was not tested. |
| Self-approval prevention (live) | **BLOCKED - INVESTIGATE** | The user reported approving with the only available account, which was the decision submitter, and seeing the case become `APPROVED`. The service code rejects matching submitter/approver user IDs, so the browser report conflicts with the expected guard. Verify the persisted approver identity before concluding whether this is a defect. The synthetic case is test-only and must not be treated as a genuine KYC determination. |
| Admin audit browsing and filtering | **PASSED** | Admin opened `/admin/audit-events`; filtering by `KYC_CASE_CLOSED` showed the synthetic case closure event. Admin dashboard itself is role-restricted; the authorized audit route worked directly. |
| Customer information request and response | **PASSED** | After V7 was applied, the user confirmed the analyst's `NEEDS_INFORMATION` submission succeeded, the customer could see the request and submitted a response, and the response action succeeded in the browser. The focused H2 workflow test also passed. Direct post-fix SQL inspection of the communication rows was not performed. |
| Analyst resume after customer response | **PASSED** | After the successful customer response, the user resumed the case as the assigned analyst and confirmed it returned to `IN_REVIEW`. No additional decision was submitted. |
| Communication audit rows after V7 | **PASSED** | As `API_CLIENT_ADMIN`, the user searched the admin audit page and confirmed both `KYC_INFORMATION_REQUESTED` and `KYC_CUSTOMER_INFORMATION_PROVIDED` events are visible. No case/customer identifiers were recorded. |
| Customer-facing status-history restriction | **NOT TESTED** | The customer UI showed “Status Information” rather than the staff-only “Audit & Status History” tab, but the staff-only endpoint was not directly requested as the customer. |
| Cross-case document denial | **NOT TESTED** | No mismatched case/document download was attempted. |
| Live frontend browser smoke | **BLOCKED** | Authenticated role navigation, profile/case creation, assignment, uploads, review, decision, prior high-risk rejection/closure, admin filtering, ownership denial, post-V7 communication, and authorized download were exercised. A possible same-user approval discrepancy now requires investigation. Pagination and session expiry remain untested. |
| Production demo controls | **PASSED** | Frontend tests passed; the generated production bundle contained neither the fixed demo password sentinel nor the local demo-account hint. |
| Backend automated verification | **PASSED** | After V7 code changes, `mvn -q verify`; 10 Surefire suites, 30 tests, 0 failures, 0 errors, 0 skipped. Focused `DocumentAssignmentApiTest` also passed. |
| Frontend lint | **PASSED** | `npm run lint` exit code 0. |
| Frontend tests | **PASSED** | `npm test`; 9 test files, 31 tests passed. |
| Frontend production build | **PASSED** | `npm run build` exit code 0; TypeScript and Vite production build succeeded. |
| Patch whitespace | **PASSED** | `git diff --check` exit code 0. |
| Secret/data hygiene | **PASSED** | `.env` was not modified or displayed; no credentials or tokens were added to reports. Test data used fictional accounts and user-confirmed synthetic document content. No destructive database operation was run. |

## Flyway and MySQL schema details

The MySQL migration history contains:

| Version | Script | Checksum | Success |
|---|---|---:|---|
| V1 | `V1__create_phase1_schema.sql` | -1686350257 | Yes |
| V2 | `V2__seed_roles.sql` | 293534251 | Yes |
| V3 | `V3__add_document_and_assignment_tables.sql` | 1518908423 | Yes |
| V4 | `V4__add_verification_workflow.sql` | -277840470 | Yes |
| V5 | `V5__allow_supervisor_approval_for_rejections.sql` | -1897506717 | Yes |
| V6 | `V6__add_case_communications.sql` | -1256540301 | Yes |
| V7 | `V7__widen_case_communication_type.sql` | Not separately queried | Yes |

V7's actual filename is `V7__widen_case_communication_type.sql`. The communication schema has `case_communications` and `case_communication_documents`. The live metadata showed the expected foreign keys to cases, users, decisions, communications, and documents; the composite parent/case key enforces same-case response linkage. The live schema also contains the message/type/link checks, unique parent-response relationship, primary/unique keys, and case/time, parent, sender, decision, and document indexes. V7 was applied without editing V1–V6 or resetting data.

## Live HTTP and browser limitations

- The post-V7 information request, customer response, and analyst resume succeeded in the guided browser test. Direct SQL verification of the communication rows and communication-specific audit trail remains outstanding.
- The earlier supervisor-created HIGH-risk case completed a synthetic rejection and closure path. The current separate HIGH-risk test case has a synthetic APPROVE recommendation and is reported as `APPROVED`; the approving user identity is not yet verified.
- The case's document and verification checks were synthetic test fixtures only; none are evidence of KYC verification.
- High-risk APPROVE reached the reported final state, but independent approval is unverified. Supervisor return-for-review, cross-case document mismatch, and authenticated customer status-history endpoint denial remain untested.

## Remaining release blockers

1. As an admin, inspect the `SUPERVISOR_DECISION_REVIEWED` audit event for the recent synthetic case and verify whether the approver identity matches the decision submitter. Do not share user identifiers in chat.
2. Resolve the possible self-approval discrepancy before continuing workflow tests or treating the approval path as passed.
3. Then exercise supervisor return-for-review, cross-case document denial, and customer direct status-history endpoint denial.
4. Verify communication rows after V7 and query V7's recorded checksum if database inspection becomes available.
5. Update this report with remaining live results before considering release readiness.

## Guided testing checkpoint

The user resumed testing and created a new synthetic HIGH-risk case, assigned the fictional analyst, started review, uploaded a synthetic document, recorded three synthetic checks, and submitted an APPROVE recommendation. The user then reported approving it with the only available account (the submitter) and seeing `APPROVED`. Next: use the admin audit view to verify the recorded approver identity; stop before further workflow decisions until this discrepancy is resolved.

No credentials, session tokens, customer identifiers, or uploaded customer data are included in this report. No database reset, deletion, migration repair, or destructive operation was performed.
