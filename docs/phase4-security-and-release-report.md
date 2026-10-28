# Phase 4 Security and Release Readiness Report

## Executive summary

Phase 4 hardening changes and regression tests are implemented. A fresh full Maven verification passes on Java 21. The OWASP Dependency-Check scan was started but could not complete within the available run: without an NVD API key, only 10,000 of 415,987 vulnerability records had downloaded after several minutes. MySQL is running locally, but no separately authorized test schema or credentials were available.

**Release decision: NOT READY.** The dependency scan produced no findings report, and clean-schema migration, full MySQL-backed workflow acceptance, production-profile runtime checks, concurrency validation, and deployment-control evidence remain incomplete. Do not interpret the successful H2 tests or existing-database startup as release acceptance.

## Baseline findings

The baseline was recorded before the Phase 4 source changes:

- Authentication uses opaque random cookie sessions, stores SHA-256 token hashes, expires sessions after eight hours, and supports logout revocation. Cookies are HttpOnly and SameSite Strict; the production profile enables Secure.
- Backend services enforce customer ownership, analyst assignment, supervisor access, and case/document scoping. Document content uses AES-256-GCM in storage outside the application directory. Uploads validate size, filename, signature, declared MIME type, and PDF/image structure. Download responses use attachment disposition, `no-store`, and `nosniff`.
- `backend/.env` was ignored and not tracked. The tracked `backend/.env.example` contains placeholders only.
- **Confirmed, MEDIUM — unsafe default profile:** the base configuration defaulted to `local`, which enables demo-account seeding and non-Secure session cookies if deployment omitted an active profile.
- **Confirmed, LOW — production API discovery:** Spring Security permitted OpenAPI and Swagger anonymously in every profile, and the production profile did not disable them.
- **Confirmed, MEDIUM — production datasource fallback:** the production profile inherited default datasource URL and username values instead of requiring explicit production runtime credentials. Missing settings could select the local host/name or local username.
- **Confirmed, MEDIUM — unbounded login-throttle state:** the process-local limiter retained an unbounded map of client windows. Its per-instance scope also meant it was not a distributed limiter.
- The test profile used H2 with Flyway disabled. Baseline `mvn test` on Java 21 passed **24 tests**, but did not prove MySQL migrations, constraints, or concurrency behavior.
- No dependency vulnerability scanner was installed or otherwise available on PATH.
- No MySQL-backed full workflow acceptance or clean-database migration test was part of the baseline.

These are findings from the checked-in source and configuration, not conclusions based solely on a checklist.

## Confirmed findings and remediation

| Baseline finding | Severity and rationale | Remediation/status |
|---|---|---|
| Default profile selected local demo seeding and non-Secure cookies | **MEDIUM:** a deployment missing its profile could run local-only behavior; demo passwords were environment supplied, not hard-coded defaults | Default profile is now `prod`; `run-local.ps1` explicitly selects `local`. |
| OpenAPI and Swagger were anonymously available in production | **LOW:** disclosed endpoint/schema information but no direct data access was identified | Disabled API docs and Swagger UI in `application-prod.yml`; public local docs remain available for development. |
| Production datasource inherited local URL/username defaults | **MEDIUM:** incomplete deployment configuration could target the wrong database identity/location | Production requires `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`; tested the production YAML properties. |
| Login rate-limit map could grow without a bound | **MEDIUM:** many distinct source addresses could consume application memory | Added a 10,000-window cap, expired-window cleanup, and a shared overflow bucket. A shared gateway/WAF limiter is still needed for multi-instance deployments. |

No confirmed customer-data authorization bypass, document path traversal, upload type bypass, or session-token exposure was identified in the inspected paths. Absence of such a finding is not a substitute for penetration testing.

## Files changed

- `backend/src/main/resources/application.yml` — changes the default profile to production so local seeding is opt-in.
- `backend/src/main/resources/application-prod.yml` — requires explicit runtime and separate Flyway credentials; disables production OpenAPI/Swagger; retains Secure cookies and required document storage settings.
- `backend/run-local.ps1` — explicitly selects the local profile for the local-only script.
- `backend/src/main/java/com/example/kyc/auth/LoginRateLimiter.java` — bounds in-memory login-rate-limit state and limits overflow clients together.
- `backend/src/main/java/com/example/kyc/common/ApiExceptionHandler.java` — logs unexpected exception type and correlation ID without logging exception messages, request data, or secrets.
- `backend/src/test/java/com/example/kyc/auth/AuthAndAuthorizationApiTest.java` — adds unauthenticated/CSRF checks and security-header/CORS assertions.
- `backend/src/test/java/com/example/kyc/auth/LoginRateLimiterTest.java` — adds coverage for rate-limit capacity and overflow behavior.
- `backend/src/test/java/com/example/kyc/document/DocumentAssignmentApiTest.java` — adds document cross-case and unassigned-analyst upload/download denials and secure-download-header assertions.
- `backend/src/test/java/com/example/kyc/security/ProductionConfigurationTest.java` — verifies production is the default profile and requires explicit production datasource/migration/storage configuration while disabling API docs.
- `README.md` — documents environment variables, role access, production operation, HTTPS/proxy, storage encryption recovery, rate limiting, malware scanning limitations, and test/database limitations.
- `docs/phase4-security-and-release-report.md` — this evidence-based report.

No Flyway migration was changed or added for Phase 4. The `.env` file was not read or modified; no credentials or key values are included in this report.

## Tests and build

- Baseline: `mvn test` on Java 21 — **24 tests passed**, no failures/errors/skips.
- Final: `mvn verify` on Java 21.0.12.1 — **28 tests passed, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**.
- Follow-up: repeated `mvn verify` with Maven using Java 21.0.12.1 — **28 tests passed, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**.
- `git diff --check` passed.
- New regression assertions cover unauthenticated access, CSRF enforcement, absent cross-origin allow headers, standard security headers, cross-case document lookup, unassigned document upload/download, limiter capacity, production profile selection, required configuration, and disabled production docs.
- These application tests use H2; they do not prove MySQL database constraints or production-profile startup with real deployment infrastructure.

## Database and end-to-end acceptance

- Local startup with Java 21 using `backend/run-local.ps1` succeeded.
- Flyway validated the five applied migrations and reported the existing MySQL schema at version 5. Hibernate initialized and Spring Boot started on port 8080.
- `GET /api/v1/auth/csrf` returned HTTP 200. Local `/v3/api-docs` returned HTTP 200, as expected for development.
- The local database was already at V5; no destructive database operation was run.
- **Clean-database migration: NOT RUN.** The MySQL 8 service and local port 3306 are available, and MySQL Shell is installed. No separate prepared development schema or authorized database credentials were available in the process environment. The ignored `backend/.env` was deliberately not read. No attempt was made to guess credentials or create, drop, reset, or overwrite a database.
- **Full MySQL-backed workflow: NOT RUN.** Existing integration/API coverage exercised workflows on H2; live MySQL verification was limited to startup, schema validation, and the CSRF endpoint.
- **Production profile runtime: NOT RUN.** Production configuration was checked by an automated YAML-property test, not by starting against a separately provisioned production-like database and storage service.
- **Concurrency and rollback: NOT runtime-verified.** The workflow implementation uses a pessimistic case-row lock, optimistic version field, and transactional service methods (`KycCaseRepository`, `KycCase`, and `VerificationWorkflowService`), but these are not evidence of concurrent behavior against MySQL. No concurrent decision/approval or forced-rollback test was run.

## Dependency vulnerability scan

- Scanner: OWASP Dependency-Check Maven plugin **12.1.0**.
- Execution: started against the backend Maven project with tests skipped for the scan invocation. The scanner began updating the NVD vulnerability database and reported **415,987 records** to download. Without an NVD API key it downloaded **10,000 records (2%) after several minutes**; the run was stopped before analysis completed.
- Findings: **no complete scan results; severity, affected dependencies/versions, and exploitability cannot be determined.** No vulnerability report was generated. This is an incomplete scan, not a clean result.
- Recommended next step: run Dependency-Check in an approved environment with a valid NVD API key supplied through a protected environment/secret mechanism (not committed or placed in this report), allow its database update and analysis to finish, then review the generated report. Remediate only confirmed relevant findings with compatible dependency updates and rerun `mvn verify`.
- Maven dependency resolution and a successful build are not vulnerability scanning.

## Remaining risks and operational requirements

- The login limiter remains process-local. Configure a shared gateway/WAF limit for multiple instances and deployments behind a common proxy address; do not trust arbitrary client-supplied forwarding headers.
- This application does not malware-scan uploaded files. Add an approved scanning control before production if required by deployment policy.
- The document store uses a single AES-256 key without key-version metadata. Back up the key separately, test recovery, and retain the old key until a planned re-encryption/rotation has been verified.
- Deploy behind a trusted TLS-terminating reverse proxy, block direct public access to the application, and configure forwarded-header handling only when the proxy strips client-supplied forwarding headers.
- No production CORS origins are configured. Keep clients same-origin or add a reviewed explicit allow-list; do not use wildcard origins with cookie credentials.
- Clean-schema MySQL migration, complete MySQL workflow tests, production-profile runtime checks, a complete dependency scan and triage, and concurrency/rollback tests remain required before release.

## Safe steps to unblock MySQL validation

1. Have an authorized database administrator provision a **new, empty, dedicated development schema** and separate least-privilege application and Flyway accounts. Do not point these checks at the existing development schema.
2. Provide the test-only JDBC URLs, usernames, and passwords, plus a protected temporary document-storage directory and test encryption key, through the approved secret/environment mechanism. Do not place secrets in source control or this report.
3. Run Flyway V1 through the latest migration against that new schema, then start the application with Hibernate schema validation enabled. Record the resulting migration versions/checksums and startup result.
4. With fictional records in that schema, exercise authentication and authorization, case creation, document upload/retrieval, assignment, checks, decisions, supervisor review, additional-information resubmission, closure, history/audit events, and cross-case/unauthorized denials over the API.
5. Run concurrent decision submissions, conflicting approvals, and a forced transaction rollback against that same isolated MySQL schema. Retain sanitized test output only.
6. Separately run the production profile with non-default test credentials and protected storage. Confirm missing required settings fail safely, no demo accounts are seeded, Secure cookies are configured, production API docs are unavailable, and startup output contains no credentials.

## Release-readiness checklist

- [x] Java 21 build and automated regression suite pass.
- [x] Production profile defaults to fail-closed production configuration; local profile is explicitly selected by the local script.
- [x] Production API docs are disabled by configuration and tested at the property level.
- [x] Existing MySQL V5 schema validates and application starts locally.
- [ ] Clean MySQL schema migration succeeds.
- [ ] Full KYC workflow and authorization acceptance pass against MySQL.
- [ ] Production-profile startup is verified with separately provisioned runtime/migration credentials and protected storage.
- [ ] Dependency vulnerability scan completes and findings are triaged.
- [ ] Concurrent decision/approval and transaction rollback are tested against MySQL.
- [ ] Shared rate limiting, HTTPS/proxy configuration, backups/key recovery, and any required malware scanning are validated in the target deployment environment.

## Final status

**NOT READY.** The Java 21 verification passes, but the dependency scan did not complete and yielded no findings; the clean-schema migration, MySQL workflow and concurrency/rollback checks, production-profile runtime acceptance, and target-environment deployment controls still need evidence. The completed code hardening and passing H2-based suite are insufficient to declare release readiness.
