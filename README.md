# Secure Customer KYC Verification API

Phase 1 foundation, Phase 2 document/assignment support, and Phase 3 verification/approval workflow for the Secure Customer KYC Verification API.

## Status and scope

Implemented in source: role-aware authentication, customer and KYC case APIs, audit persistence, case assignment history, encrypted document upload/version/download, verification checks, immutable decision and supervisor-approval records, controlled case status transitions, and OpenAPI. No React frontend is included.

The [SRS PDF](<./docs/10_Secure_Customer_KYC_Verification_API (1).pdf>) requires supervisor approval for configured high-risk outcomes but does not specify which outcomes to configure. This project configures both `APPROVE` and `REJECT`. The supported/required verification catalogue, required document type, and submitter-not-approver rule remain project defaults or policy documented in [the API guide](./docs/phase2-api-guide.md), rather than explicit SRS requirements.

The SRS does not prescribe customer fields, case type/risk/priority enums, file types, document review statuses, or local-storage encryption. Customer fields and case enums were explicitly confirmed for the earlier foundation. PDF/JPEG/PNG, `PENDING_REVIEW -> ACCEPTED | REJECTED`, and AES-256-GCM local storage were confirmed for Phase 2. Document type is validated as an uppercase identifier because no document-type reference list was supplied.

## Stack and setup

- Java 21, Maven 3.9+, MySQL 8.0.16+ (for enforced `CHECK` constraints).
- Spring Boot 3.5.7 with Spring Web, Security, Data JPA, Bean Validation, Flyway, MySQL Connector/J, Springdoc, and Apache PDFBox 3.0.5.
- UUIDs are stored as `CHAR(36)`. Timestamps use UTC. Flyway owns the schema; Hibernate uses `ddl-auto: validate`.
- Local development uses a stateful, opaque HttpOnly cookie. The database stores only its SHA-256 hash in `auth_sessions`; logout revokes the row. Passwords use BCrypt with work factor 12. CSRF uses a separate `XSRF-TOKEN` cookie and `X-XSRF-TOKEN` header.
- Upload content is AES-256-GCM encrypted before being written to a generated storage key outside the web root. The key must be provided outside the repository.

### 1. Prepare MySQL

Start a local MySQL 8 service (if needed) and run this as a database administrator. Replace the password locally:

```sql
CREATE DATABASE kyc_verification
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'kyc_app'@'localhost' IDENTIFIED BY 'replace-with-a-local-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON kyc_verification.* TO 'kyc_app'@'localhost';
```

The local Flyway account needs DDL privileges. Production should use separate migration credentials and a restricted runtime account. If the `kyc_verification` database already exists, inspect it before using it; Flyway should be run against the intended empty development database.

### 2. Configure and run (PowerShell)

Install Java 21 and Maven 3.9+. The local run script selects a Java 21 installation from `JAVA_HOME_21_X64`, `JAVA_HOME`, or standard Windows JDK installation folders. If Java 21 is installed elsewhere, set `JAVA_HOME` to its JDK directory before running the script.

Set a local database password, four fictional demo-account passwords (at least 12 characters each), and a stable random 32-byte AES key. Keep these values in a local secret manager or shell profile excluded from Git. Generate the key once and securely preserve it; losing it makes stored files unreadable.

```powershell
$env:DB_URL = 'jdbc:mysql://localhost:3306/kyc_verification?serverTimezone=UTC'
$env:DB_USERNAME = 'kyc_app'
$env:DB_PASSWORD = '<local database password>'

$env:DEMO_CUSTOMER_PASSWORD = '<fictional local password, 12+ chars>'
$env:DEMO_ANALYST_PASSWORD = '<fictional local password, 12+ chars>'
$env:DEMO_SUPERVISOR_PASSWORD = '<fictional local password, 12+ chars>'
$env:DEMO_ADMIN_PASSWORD = '<fictional local password, 12+ chars>'

$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$env:KYC_STORAGE_KEY = [Convert]::ToBase64String($bytes)
$env:KYC_STORAGE_ROOT = Join-Path $env:USERPROFILE '.secure-customer-kyc-api\documents'
$env:KYC_MAX_FILE_SIZE = '10485760'

Set-Location 'D:\IOC-Project\secure-customer-kyc-api\backend'
.\run-local.ps1
```

The script loads `backend\.env`, selects Java 21 for Maven and the Spring Boot runtime, then starts the application. To run tests with Java 21, set the current PowerShell process to the same JDK before running Maven:

```powershell
$env:JAVA_HOME = '<path to your Java 21 JDK>'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
mvn test
```

The local profile requires the environment variables above and fails closed if they are missing.

Flyway applies `V1__create_phase1_schema.sql` through `V5__allow_supervisor_approval_for_rejections.sql`. Hibernate validates the schema. `local` profile seeds `customer@example.test`, `analyst@example.test`, `supervisor@example.test`, and `admin@example.test` only if absent; only BCrypt hashes are stored. The role list is CUSTOMER, KYC_ANALYST, COMPLIANCE_SUPERVISOR, and API_CLIENT_ADMIN. The API Client Administrator has no unrestricted business-data access.

Swagger UI: `http://localhost:8080/swagger-ui.html`

### Schema

`users`, `roles`, `user_roles`, `api_clients`, `customers`, `kyc_cases`, `audit_events`, and `auth_sessions` are established by V1. `kyc_documents`, `document_versions`, and `case_assignments` are added by V3. V4 adds the verification workflow tables and extends the allowed case statuses with `NEEDS_INFORMATION` and `CLOSED`. V5 updates the decision constraint so either `APPROVE` or `REJECT` may require supervisor approval; `NEEDS_INFORMATION` cannot. Version rows preserve prior encrypted content references; assignments retain ended rows as history. Documents and case assignments do not cascade-delete business records. A startup reconciliation deletes encrypted files older than 24 hours that are no longer referenced by a document-version row. Upload rollback also tries to delete its newly written object.

File metadata (type, sanitized-as-provided filename, detected MIME, byte size, checksum, version, reviewer status) is stored in MySQL. The encrypted file content is stored outside the database and outside the public web root. API responses never include storage paths or keys and never return public URLs.

## Manual API verification

See the full Postman/Swagger walk-through in [docs/phase2-api-guide.md](</C:/Users/Pazhani vel B/OneDrive/Desktop/AI_ML_Projects/secure-customer-kyc-api/docs/phase2-api-guide.md>). All writes require a CSRF token. Send a `X-Correlation-ID` header if you want to supply a safe trace identifier; otherwise one is generated and returned.

## Tests and verification limits

From `backend`, run `mvn test`. Unit tests exercise login success/failure, rate limiting, case transitions, file type/size/signature validation, and encrypted storage/path validation.

The `test` profile uses an in-memory H2 database, disables Flyway, and uses Hibernate `create-drop`; a passing Maven test run does not verify migrations against MySQL. Use the existing local configuration and `run-local.ps1` with an explicitly prepared development database to verify Flyway and Hibernate schema validation. Do not drop or reset a shared database.

## Remaining work

- Confirm non-SRS workflow defaults, including the verification catalogue, required document type, and submitter-not-approver rule, with stakeholders.
- Add MySQL-backed integration/API tests for migrations and transaction/concurrency behavior.
- Run the SQL migrations on a clean MySQL database.
- Add the requested React + TypeScript frontend only after backend integration verification.
- Complete clean-MySQL acceptance checks before creating the `v0.3-verification` milestone tag.
