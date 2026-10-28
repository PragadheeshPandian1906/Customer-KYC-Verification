# Phase 1/2 API manual test guide

Base URL: `http://localhost:8080`. All user accounts below are fictional local development accounts; set their passwords in environment variables as described in the project README.

## Postman authentication and CSRF setup

1. Enable Postman's cookie jar for `localhost`.
2. `GET /api/v1/auth/csrf`. Save the JSON `token` as `csrfToken`; Postman should also keep the `XSRF-TOKEN` cookie.
3. `POST /api/v1/auth/login` with JSON `{"email":"supervisor@example.test","password":"<DEMO_SUPERVISOR_PASSWORD>"}`. Include `X-XSRF-TOKEN: {{csrfToken}}`. The response sets an HttpOnly `KYC_SESSION` cookie; never copy it into a URL or log it.
4. For every POST/PATCH request below, send `X-XSRF-TOKEN: {{csrfToken}}` and retain the cookie jar. GET requests do not need the CSRF header.
5. To test another role, log out, obtain a fresh CSRF token if needed, and log in using the matching fictional development account.

`POST /api/v1/auth/logout` revokes the server-side session and clears the cookie. `GET /api/v1/auth/me` returns the authenticated user and role list. Login failures return a generic 401; after ten attempts from one client address in a 15-minute window, login returns 429.

## Phase 1 endpoints

| Method and path                                         | Permitted access                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `POST /api/v1/customers`                                | CUSTOMER creates/links their own profile; analyst or supervisor may create a customer |
| `GET /api/v1/customers?page=0&size=20&sortBy=createdAt` | CUSTOMER sees own; analyst sees customers with assigned cases; supervisor sees all    |
| `GET /api/v1/customers/{customerId}`                    | Same ownership/assignment scope as list                                               |
| `PATCH /api/v1/customers/{customerId}`                  | Same ownership/assignment scope as read                                               |
| `POST /api/v1/kyc/cases`                                | CUSTOMER may create for own customer; analyst/supervisor may create within their role |
| `GET /api/v1/kyc/cases?page=0&size=20&sortBy=createdAt` | CUSTOMER sees own; analyst sees assigned cases; supervisor sees all                   |
| `GET /api/v1/kyc/cases/{caseId}`                        | Case owner, assigned analyst, or supervisor                                           |
| `PATCH /api/v1/kyc/cases/{caseId}`                      | Only a supervisor may change risk/priority; status fields are rejected                |
| `GET /api/v1/kyc/cases/{caseId}/status`                 | Same as case read                                                                     |
| `GET /api/v1/customers/{customerId}/cases`              | Customer owner, assigned analyst, or supervisor                                       |

Example create customer (analyst):

```http
POST /api/v1/customers
Content-Type: application/json
X-XSRF-TOKEN: {{csrfToken}}

{"displayName":"Fictional Example","email":"example.customer@example.test"}
```

Example create case (supervisor or customer for their own customer):

```http
POST /api/v1/kyc/cases
Content-Type: application/json
X-XSRF-TOKEN: {{csrfToken}}
Idempotency-Key: {{newUniqueKey}}

{"customerId":"{{customerId}}","caseType":"INDIVIDUAL","riskLevel":"LOW","priority":"NORMAL"}
```

Repeated requests with the same creator/key and same request return the original case; reusing the key with a different payload returns 409. The controlled Phase 3 workflow is documented below. Do not send status fields through the generic case patch endpoint.

## Phase 2 document endpoints

| Method and path                                                                          | Permitted access                                                                                      |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `POST /api/v1/kyc/cases/{caseId}/documents`                                              | Customer who owns the case, assigned analyst, or supervisor                                           |
| `GET /api/v1/kyc/cases/{caseId}/documents`                                               | Same case scope                                                                                       |
| `GET /api/v1/kyc/cases/{caseId}/documents/{documentId}`                                  | Same case scope; mismatched case/document pair returns 404                                            |
| `GET /api/v1/kyc/cases/{caseId}/documents/{documentId}/versions`                         | Same case scope                                                                                       |
| `POST /api/v1/kyc/cases/{caseId}/documents/{documentId}/versions`                        | Same case scope while case is not terminal                                                            |
| `PATCH /api/v1/kyc/cases/{caseId}/documents/{documentId}/status`                         | Assigned analyst or supervisor during active review; supervisor required at supervisor-approval state |
| `GET /api/v1/kyc/cases/{caseId}/documents/{documentId}/download`                         | Same case scope                                                                                       |
| `GET /api/v1/kyc/cases/{caseId}/documents/{documentId}/versions/{versionNumber}/content` | Same case scope                                                                                       |

For upload, choose **Body → form-data** and add:

- `documentType` (Text), e.g. `IDENTITY_EVIDENCE`
- `file` (File), PDF/JPEG/PNG, no larger than `KYC_MAX_FILE_SIZE` (10 MiB default)
- Optionally include `Idempotency-Key: {{uniqueUploadKey}}`; an exact retry returns the original document/version, while reusing the key with different content or metadata returns 409.

The server validates the extension, signature, declared MIME type when provided, and PDF/image structure. Client MIME type alone is not trusted. Filenames containing path separators are rejected. The response includes metadata but never a filesystem path, storage key, or public URL.

For `POST .../{documentId}/versions`, send the `file` multipart field and an optional unique `Idempotency-Key`. An exact retry returns the same version; a key reused with different content returns 409.

Example review update:

```http
PATCH /api/v1/kyc/cases/{{caseId}}/documents/{{documentId}}/status
Content-Type: application/json
X-XSRF-TOKEN: {{csrfToken}}

{"status":"ACCEPTED"}
```

Status is `PENDING_REVIEW` after each upload/version and can move once to `ACCEPTED` or `REJECTED`. A new version resets review to `PENDING_REVIEW`. Document review is limited to active case review; high-risk cases awaiting supervisor approval require a supervisor.

## Phase 2 assignments

| Method and path                               | Permitted access                                       |
| --------------------------------------------- | ------------------------------------------------------ |
| `POST /api/v1/kyc/cases/{caseId}/assignments` | COMPLIANCE_SUPERVISOR                                  |
| `GET /api/v1/kyc/cases/{caseId}/assignments`  | COMPLIANCE_SUPERVISOR or analyst assigned to that case |

Example:

```http
POST /api/v1/kyc/cases/{{caseId}}/assignments
Content-Type: application/json
X-XSRF-TOKEN: {{csrfToken}}

{"analystUserId":"{{analystUserId}}"}
```

Only an enabled KYC_ANALYST can be assigned. Reassignment closes the prior assignment row and creates a new history row. Assignments are rejected for terminal cases.

## Expected errors and persistence

Errors use `application/problem+json` with title, status, safe detail, and `correlationId`. Common outcomes: 400 validation/input error, 401 missing/invalid session, 403 role denial, 404 missing or out-of-scope resource, 409 workflow/version conflict, 413 oversized upload, 415 unsupported/mismatched file, 429 throttled login, 500 safe storage/server error.

Expected database changes:

- Customer/case requests insert/update `customers`/`kyc_cases`; case creation stores the idempotency key.
- Each document upload inserts `kyc_documents` and `document_versions`; a new version inserts another version row and increments the document version.
- Review updates change the document status.
- Assignment/reassignment inserts `case_assignments`; reassignment timestamps the old row's `ended_at` and updates the case assignee.
- Important outcomes are recorded in `audit_events`; no passwords, session tokens, document bytes, or storage paths are included.
- Encrypted document bytes are stored in `KYC_STORAGE_ROOT`, outside the repository/web root. Failed transaction cleanup deletes the just-written file; startup reconciliation removes unreferenced encrypted files older than 24 hours.

## Phase 3 verification and supervisor approval

| Method and path                                                                | Permitted access                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `POST /api/v1/kyc/cases/{caseId}/review/start`                                 | Assigned KYC_ANALYST or COMPLIANCE_SUPERVISOR; starts/resumes review |
| `POST /api/v1/kyc/cases/{caseId}/verification-checks`                          | Assigned KYC_ANALYST or COMPLIANCE_SUPERVISOR during IN_REVIEW       |
| `GET /api/v1/kyc/cases/{caseId}/verification-checks`                           | Same staff scope                                                     |
| `POST /api/v1/kyc/cases/{caseId}/verification-results`                         | Assigned KYC_ANALYST during IN_REVIEW                                |
| `GET /api/v1/kyc/cases/{caseId}/verification-decisions`                        | Assigned analyst or supervisor                                       |
| `GET /api/v1/kyc/cases/{caseId}/approvals/pending`                             | COMPLIANCE_SUPERVISOR, only while approval is pending                |
| `POST /api/v1/kyc/cases/{caseId}/verification-decisions/{decisionId}/approval` | COMPLIANCE_SUPERVISOR; submitter cannot review their own decision    |
| `POST /api/v1/kyc/cases/{caseId}/close`                                        | COMPLIANCE_SUPERVISOR, after a final APPROVED/REJECTED result        |
| `GET /api/v1/kyc/cases/{caseId}/status/history`                                | Assigned analyst or supervisor                                       |

Phase 3 defaults are explicit configuration decisions because the SRS file was not available in the workspace:

- Supported check types: `CUSTOMER_INFORMATION`, `IDENTITY_DOCUMENT`, `ADDRESS_DOCUMENT`.
- Required check types: the same three, each needing a latest non-`NEEDS_INFORMATION` result. An `APPROVE` recommendation requires all three to be `PASS`.
- Required document type: `IDENTITY_EVIDENCE`. It must exist and be reviewed (not `PENDING_REVIEW`) before a decision; an `APPROVE` recommendation additionally requires it to be `ACCEPTED`.
- Override catalogues through `KYC_VERIFICATION_CHECK_TYPES`, `KYC_REQUIRED_CHECK_TYPES`, and `KYC_REQUIRED_DOCUMENT_TYPES` (comma-separated uppercase identifiers). Every required check must be in the supported catalogue.
- The submitter cannot review their own decision. A supervisor `APPROVED` result endorses the analyst recommendation; a supervisor `REJECTED` result returns the case to `IN_REVIEW` for a new decision.
- The SRS requires supervisor approval for configured high-risk outcomes but does not enumerate them. This project configures high-risk `APPROVE` and `REJECT` recommendations for supervisor review; `NEEDS_INFORMATION` does not require approval.

The workflow keeps the existing statuses and adds `NEEDS_INFORMATION` and `CLOSED`: `DRAFT -> IN_REVIEW -> (APPROVED | REJECTED | PENDING_SUPERVISOR_APPROVAL | NEEDS_INFORMATION)`. An `APPROVE` or `REJECT` recommendation for a high-risk case enters `PENDING_SUPERVISOR_APPROVAL`. A supervisor approval finalizes the recommendation as `APPROVED` or `REJECTED`; a supervisor rejection of the recommendation returns the case to `IN_REVIEW`. An analyst can resume a `NEEDS_INFORMATION` case with `/review/start`. `APPROVED` or `REJECTED` cases may be closed only by a supervisor. Attempts to close any other state return 409. Closed cases cannot accept document or workflow changes.

Example check:

```http
POST /api/v1/kyc/cases/{{caseId}}/verification-checks
Content-Type: application/json
X-XSRF-TOKEN: {{csrfToken}}

{
  "checkType": "IDENTITY_DOCUMENT",
  "result": "PASS",
  "notes": "Synthetic test evidence matched",
  "documentId": "{{documentId}}"
}
```

Allowed check results are `PASS`, `FAIL`, `NEEDS_INFORMATION`, and `NOT_APPLICABLE`. Each submission appends a row; it does not overwrite prior checks. Notes must be non-sensitive and are limited to 500 characters.

Example analyst recommendation:

```http
POST /api/v1/kyc/cases/{{caseId}}/verification-results
Content-Type: application/json
X-XSRF-TOKEN: {{csrfToken}}
Idempotency-Key: {{uniqueDecisionKey}}

{"outcome":"APPROVE","reasonCode":"CHECKS_COMPLETE","rationale":"Required checks and documents reviewed"}
```

Decision outcomes are `APPROVE`, `REJECT`, and `NEEDS_INFORMATION`. `NEEDS_INFORMATION` requires a rationale and does not require the readiness gate; its decision and case status are recorded. Replaying a decision with the same submitter/key/payload returns the original decision; a different payload with that key returns 409.

Both `APPROVE` and `REJECT` require the configured checks and a reviewed required document. An `APPROVE` recommendation additionally requires every mandatory check to be `PASS` and every required document to be `ACCEPTED`. `REJECT` may proceed after the required checks are complete (a result other than `NEEDS_INFORMATION`) and required documents are reviewed; a failed check or rejected document can support the rejection. A high-risk `REJECT` requires supervisor approval under the selected project policy.

Example supervisor review:

```http
POST /api/v1/kyc/cases/{{caseId}}/verification-decisions/{{decisionId}}/approval
Content-Type: application/json
X-XSRF-TOKEN: {{csrfToken}}

{"outcome":"APPROVED","reason":"Reviewed the analyst recommendation"}
```

`outcome` must be `APPROVED` or `REJECTED`; a reason is mandatory for `REJECTED`. Approval rows are append-only and unique per decision. A repeated/conflicting review returns 409. Case IDs are validated together with decision IDs.

`PATCH /api/v1/kyc/cases/{caseId}` may update only supervisor-controlled risk/priority fields and rejects any request containing `status`. Case state changes use the workflow endpoints and are serialized by a pessimistic case-row lock. `case_status_history`, `verification_checks`, `verification_decisions`, `supervisor_approvals`, and `audit_events` retain the workflow trail; writes and status transitions share a transaction.

## End-to-end verification

1. Login as supervisor; create a fictional customer and case, assign an analyst, and call `POST .../{caseId}/review/start`.
2. Upload a synthetic PDF as `IDENTITY_EVIDENCE`; review it as accepted.
3. As the assigned analyst or supervisor, add a latest PASS check for each configured required check type. A decision attempt before these checks/document review should return 409.
4. As the assigned analyst, submit an `APPROVE` or `REJECT` recommendation. For high risk, confirm case status is `PENDING_SUPERVISOR_APPROVAL`; read its pending approval as supervisor.
5. Try approval as the decision submitter (including a user holding both roles); expect 403. As a different supervisor, approve or reject the recommendation. A rejected review returns the case to `IN_REVIEW`; submit a new decision if needed.
6. For a `NEEDS_INFORMATION` recommendation, provide a rationale, verify `NEEDS_INFORMATION`, then resume with `/review/start` after information is supplied.
7. Close a final `APPROVED` or `REJECTED` case as supervisor; attempts to close earlier or change status with generic PATCH should fail.
8. Inspect `verification_checks`, `verification_decisions`, `supervisor_approvals`, `case_status_history`, and `audit_events`. No authentication tokens, document bytes, or unnecessary personal data should appear in audit records.
