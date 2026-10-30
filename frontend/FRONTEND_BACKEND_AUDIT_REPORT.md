# Frontend Discovery and Backend Integration Audit

## Executive summary

The existing frontend is a React 18, TypeScript, Vite application with a custom Tailwind UI. It is not a mock-only prototype: the main authentication, customer, case, document, verification, and approval flows call the Spring API through a shared HTTP client. The backend remains the authorization boundary.

The initial audit checks passed with 17 Vitest tests. Phase 5B fixes have since been verified with TypeScript lint, **26 Vitest tests**, and a production Vite build. The backend was previously started with the existing local launcher on Java 21, and read-only live API smoke checks verified CSRF bootstrap, unauthenticated access denial, and local OpenAPI availability. Those checks do not prove authenticated customer/analyst/supervisor workflows; those remain unverified.

Important findings:

- The initial audit found supervisor evidence failures could be mistaken for empty evidence and still permit approval/rejection. Phase 5B now displays independent evidence states, provides retry, and disables review until all evidence requests succeed.
- Dashboard totals and queues initially used one page of at most 100 records; Phase 5B now follows the returned pagination metadata for cases and customer data.
- Customer case detail no longer requests staff-only verification/history/assignment endpoints. The customer status view explains that detailed history is staff-restricted; staff retain the history view.
- Analyst assignment requires a supervisor to manually enter an analyst UUID. No analyst-directory API is exposed.
- Additional-information requests have no distinct customer response endpoint. The existing document upload/version flow can provide evidence, but this is not a dedicated response workflow.
- Application code uses real backend requests. Test files mock `fetch`; these mocks are not production authentication or API behavior.

**Audit scope:** inspected frontend source, package/configuration files, tests, and the relevant Spring controllers, DTOs, service rules, and security configuration. Excluded generated `node_modules` and build output from source review. Phase 5B changed frontend source and tests only; no backend source or API contract was changed. The existing `run-local.ps1` launcher loaded its required local environment settings; their values were not manually inspected, printed, or included in this report.

## 1. Frontend architecture overview

| Area | Finding |
|---|---|
| Framework / versions | React 18.3, TypeScript 5.6 declared in `package.json` (5.9.3 installed), Vite 6 (6.4.5 installed), React Router 6, TanStack Query 5, Vitest 2.1.9. |
| Entry and routing | `src/main.tsx` mounts `App`; `src/App.tsx` provides React Query, theme, auth, and `BrowserRouter`, with routes for login, dashboard, cases, customers, approvals, and profile. |
| Structure | `src/features/` contains auth, dashboard, cases, customers, approvals, documents, verification, and profile screens/modals. `src/components/shared/` contains layout/navigation/status elements; `src/components/ui/` contains custom controls. `src/lib/` contains API, auth, theme, and utility modules; `src/types/` contains API-facing types. |
| State and fetching | Auth/theme use React Context. Feature pages mostly use local `useState`/`useEffect` and call the API client directly. A `QueryClientProvider` is present, but no feature uses React Query hooks or cache invalidation. Refresh is manually wired through callbacks/buttons. |
| Forms | Controlled React inputs and custom field components; validation is mostly inline and native HTML constraints. No dedicated form/validation library is configured. Backend validation remains authoritative. |
| Styling | Tailwind CSS 3 with dark mode via a class on `<html>`, a custom theme, custom UI components, and `lucide-react` icons. No third-party component system is configured. |
| Loading/errors/notifications | Spinner, skeleton, alert, and empty-state components exist. Errors are generally inline alerts, not a notification/toast system. Some dashboard errors are replaced with generic text; several secondary read failures are silently ignored or logged. |
| Tests | Vitest + jsdom + React Testing Library. Six test files cover auth, cases/badges, documents, verification, approvals, and theme. Assertions use mocked `fetch`; no browser-to-live-MySQL acceptance suite was found. |
| Environment | `.env.example` documents `VITE_API_BASE_URL` and optional display-only `VITE_KYC_*` catalogue settings. Vite uses the API base URL as the development proxy target; browser requests themselves use relative `/api/...` paths. Production therefore requires same-origin serving/reverse proxying as the README describes. |

## 2. Backend integration and authoritative API rules

### Authentication, authorization, and errors

- Spring exposes `GET /api/v1/auth/csrf`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, and `GET /api/v1/auth/me`.
- Login accepts `{ "email": "...", "password": "..." }` and returns `{ id, email, displayName, roles }`. The session is an HttpOnly `KYC_SESSION` cookie; the browser sends it through `credentials: 'include'`. The frontend does not persist session credentials in browser storage.
- CSRF uses Spring’s cookie token repository. The frontend fetches a token before mutations and sends `X-XSRF-TOKEN`; the API client does not use the `headerName` returned by the CSRF response and instead assumes Spring’s configured default header name.
- `SecurityConfiguration` requires authentication for other API requests. Resource-level role and ownership checks are implemented in service methods. Frontend route checks improve navigation only and do not replace backend authorization.
- Confirmed roles are `CUSTOMER`, `KYC_ANALYST`, `COMPLIANCE_SUPERVISOR`, and `API_CLIENT_ADMIN`. Customers are owner-scoped; analysts are case-assignment-scoped; supervisors have broader oversight; the backend does not expose a customer/case-management API role for `API_CLIENT_ADMIN`.
- Error responses use Spring `ProblemDetail` / `application/problem+json`, including validation fields and correlation IDs where applicable. The API client parses these and exposes `ApiError`.
- No CORS allow-list was found in the inspected security configuration. The documented Vite development proxy and production same-origin proxy are consistent with cookie/CSRF use.

### Backend workflow rules confirmed from source

- Case statuses are `DRAFT`, `IN_REVIEW`, `PENDING_SUPERVISOR_APPROVAL`, `NEEDS_INFORMATION`, `APPROVED`, `REJECTED`, and `CLOSED`.
- Case creation is available to staff and to customers for their own customer record. Case listing is scoped by customer ownership, analyst assignment, or supervisor role.
- Only supervisors assign/reassign analysts and close completed cases. Analysts must be assigned to submit decisions. Supervisors can review pending approval, but cannot review their own submitted decision.
- HIGH-risk `APPROVE` and `REJECT` decisions both require supervisor approval. `NEEDS_INFORMATION` changes the case to that state without supervisor approval. A supervisor approval of a recommendation finalizes its suggested approve/reject outcome; a supervisor rejection of the recommendation returns the case to `IN_REVIEW`.
- Approval readiness is enforced by backend configuration and service validation, not frontend preflight text. Required checks/documents are configuration-dependent.
- Status history is exposed at `GET /api/v1/kyc/cases/{caseId}/status/history`, but service authorization restricts it to staff with case access. There is no separate API for browsing raw audit events or an analyst directory/catalogue.
- Additional-information requests are represented by a `NEEDS_INFORMATION` decision and status. No dedicated endpoint for a customer response was found; supported document upload/version operations are available on writable cases.
- Document access checks are case-scoped. The backend validates uploads (including size and file content) and performs authorization independent of the frontend controls.

## 3. Feature implementation matrix

“Fully implemented” below means that the inspected UI and request mapping match the source contract; it does not mean live API acceptance was run.

| Feature | Frontend Files | Backend API | Implementation Status | Issues / Missing Work |
|---|---|---|---|---|
| Login and logout | `src/features/auth/LoginPage.tsx`, `src/lib/auth/AuthContext.tsx`, `src/components/shared/Header.tsx` | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | **FULLY IMPLEMENTED** | Real cookie-backed API flow; backend enforcement remains authoritative. |
| Session bootstrap, expiry, and recovery | `src/lib/auth/AuthContext.tsx`, `src/components/shared/ProtectedRoute.tsx` | `GET /auth/me` | **FULLY IMPLEMENTED** | HTTP 401 clears stale user state and protected routes redirect to login; network/5xx failures remain distinct, visible, and retryable. |
| CSRF | `src/lib/api/csrf.ts`, `src/lib/api/client.ts` | `GET /auth/csrf`; CSRF-protected mutations | **PARTIALLY IMPLEMENTED** | Fetches and sends token; hardcodes the header name rather than using returned `headerName`. Any mutation 403 triggers a token refresh/retry, including authorization denials. |
| Protected routes and server authorization | `src/App.tsx`, `src/components/shared/ProtectedRoute.tsx` | All authenticated APIs; service-level ownership/role checks | **FULLY IMPLEMENTED** | Route checks are UX only; source confirms backend checks remain in place. Live denial paths were not tested in this audit. |
| Role-specific navigation | `src/components/shared/Sidebar.tsx`, `src/features/dashboard/DashboardPage.tsx` | Role-scoped customer/case/approval endpoints | **PARTIALLY IMPLEMENTED** | Navigation is role-aware. Customer routes are allowed but hidden from their sidebar; `API_CLIENT_ADMIN` receives an explanatory dashboard because business admin endpoints do not exist. |
| Customer listing and search | `src/features/customers/CustomersPage.tsx` | `GET /api/v1/customers?page&size&sortBy` | **PARTIALLY IMPLEMENTED** | Paging and sort parameters match. Search remains page-local, is labeled as such, and a filtered count is labeled as the number shown on the current page. |
| Customer creation and update | `src/features/customers/CreateCustomerModal.tsx`, `src/features/customers/EditCustomerModal.tsx` | `POST /api/v1/customers`, `PATCH /api/v1/customers/{customerId}` | **FULLY IMPLEMENTED** | Staff create customer records; a logged-in customer can initialize their own linked record. No user-account registration endpoint exists. |
| Customer details | `src/features/customers/CustomerDetailPage.tsx` | `GET /api/v1/customers/{customerId}` | **FULLY IMPLEMENTED** | Request/response fields match `CustomerResponse`; backend scopes access. |
| Customer-specific case list | `src/features/customers/CustomerDetailPage.tsx` | `GET /api/v1/customers/{customerId}/cases?page&size` | **FULLY IMPLEMENTED** | Uses `PageResponse`; backend scopes customer access and analyst assignments. |
| Customer-to-case access control | `src/features/cases/CaseDetailPage.tsx`, `src/features/customers/CustomerDetailPage.tsx` | Case/customer reads | **FULLY IMPLEMENTED** | Backend owner and assignment checks are present. No live cross-customer API request was possible. |
| Case list, filters, and sort | `src/features/cases/CasesPage.tsx` | `GET /api/v1/kyc/cases?page&size&sortBy` | **PARTIALLY IMPLEMENTED** | Page and sort match; search/status/risk filters remain page-local and are explicitly labeled. |
| Case creation | `src/features/cases/CreateCaseModal.tsx`, `src/features/dashboard/CustomerDashboard.tsx` | `POST /api/v1/kyc/cases` with customerId, caseType, riskLevel, priority; optional `Idempotency-Key` | **FULLY IMPLEMENTED** | DTO and idempotency header match. Backend verifies customer ownership for customer users. |
| Case details and status display | `src/features/cases/CaseDetailPage.tsx`, `src/components/shared/StatusBadge.tsx` | `GET /api/v1/kyc/cases/{caseId}` | **FULLY IMPLEMENTED** | Status enum and response mapping match. |
| Status history | `src/features/cases/CaseDetailPage.tsx`, `src/components/shared/StatusTimeline.tsx` | `GET /api/v1/kyc/cases/{caseId}/status/history` | **FULLY IMPLEMENTED** | Staff retain the history request. CUSTOMER views skip staff-only requests and receive a clear message that detailed history is restricted; backend authorization is unchanged. |
| Assignment and reassignment | `src/features/cases/AssignCaseModal.tsx`, `src/features/cases/CaseDetailPage.tsx` | `POST/GET /api/v1/kyc/cases/{caseId}/assignments` | **PARTIALLY IMPLEMENTED** | Payload and supervisor access match, but supervisor must know and type an analyst UUID. No eligible analyst listing API exists. |
| Risk/priority editing | `src/features/cases/EditCaseModal.tsx` | `PATCH /api/v1/kyc/cases/{caseId}` | **FULLY IMPLEMENTED** | Sends only riskLevel/priority. UI limits action to supervisors and draft/in-review; backend independently enforces it. |
| Document listing and metadata | `src/features/documents/DocumentTable.tsx`, `src/features/cases/CaseDetailPage.tsx` | `GET /api/v1/kyc/cases/{caseId}/documents`, `GET .../{documentId}` | **FULLY IMPLEMENTED** | DTO fields match. Backend checks case access. |
| Initial document upload | `src/features/documents/DocumentUploadModal.tsx`, `src/lib/api/client.ts` | `POST /api/v1/kyc/cases/{caseId}/documents` multipart `documentType` and `file`; optional idempotency header | **PARTIALLY IMPLEMENTED** | Endpoint/form fields match. UI checks MIME/size but provides no transfer progress; backend is the actual file validation boundary. Live upload was not tested. |
| Document download | `src/features/documents/DocumentTable.tsx`, `src/features/approvals/ReviewApprovalModal.tsx` | `GET .../{documentId}/download` | **FULLY IMPLEMENTED** | Uses credentialed fetch, blob, and `Content-Disposition` filename. No live file retrieval was run. |
| Version history, download, and replacement upload | `src/features/documents/DocumentVersionsModal.tsx` | `GET .../{documentId}/versions`, `GET .../{documentId}/versions/{versionNumber}/content`, `POST .../{documentId}/versions` multipart `file` | **PARTIALLY IMPLEMENTED** | Paths/methods match. Replacement uploads share the initial-upload MIME/10 MiB client checks; backend validation remains authoritative. Upload progress is not shown. |
| Document review | `src/features/documents/DocumentReviewModal.tsx`, `src/features/documents/DocumentTable.tsx` | `PATCH .../{documentId}/status` with `{status}` | **FULLY IMPLEMENTED** | Status values and role/status UI conditions align; backend checks actual role, case assignment, and status. |
| Analyst assigned-case workspace/dashboard | `src/features/dashboard/AnalystDashboard.tsx`, `src/features/cases/CasesPage.tsx` | `GET /api/v1/kyc/cases` | **FULLY IMPLEMENTED** | Dashboard follows pagination metadata to retrieve all case pages; the paginated case register remains page-based. |
| Start/resume review | `src/features/verification/VerificationTab.tsx` | `POST /api/v1/kyc/cases/{caseId}/review/start` | **FULLY IMPLEMENTED** | UI offers draft/needs-information transitions; backend checks staff role and analyst assignment. |
| Verification checks | `src/features/verification/AddCheckModal.tsx`, `src/features/verification/VerificationTab.tsx` | `POST/GET /api/v1/kyc/cases/{caseId}/verification-checks` | **FULLY IMPLEMENTED** | Request fields match. Configured check names come from frontend env/defaults, while backend remains authoritative. |
| Decision submission | `src/features/verification/DecisionModal.tsx` | `POST /api/v1/kyc/cases/{caseId}/verification-results` | **FULLY IMPLEMENTED** | Outcome, reasonCode, rationale, and optional idempotency key align. Backend readiness is authoritative; frontend preflight is informational. |
| Additional-information request and customer response | `src/features/verification/DecisionModal.tsx`, `src/features/documents/DocumentTable.tsx`, `src/features/dashboard/CustomerDashboard.tsx` | Decision endpoint with `NEEDS_INFORMATION`; document upload/version endpoints | **PARTIALLY IMPLEMENTED** | Request is supported. Customer can upload evidence, but there is no dedicated response/message endpoint or explicit response action; analyst resumes review after the customer-provided update. |
| Pending approval queue | `src/features/approvals/ApprovalsPage.tsx` | Case list; `GET /{caseId}/approvals/pending` | **PARTIALLY IMPLEMENTED** | Correct supervisor-only APIs. It fetches all cases then makes per-pending-case requests; this is an N+1 queue strategy and may become slow at scale. |
| Supervisor evidence review | `src/features/approvals/ApprovalsPage.tsx`, `src/features/approvals/ReviewApprovalModal.tsx` | Customer, document, check, status history, and approval APIs | **PARTIALLY IMPLEMENTED** | If any evidence request rejects, `Promise.allSettled` results are ignored. The modal shows empty evidence and still enables review when case data loaded; this can permit a supervisor action without successfully loading review evidence (**HIGH**). |
| Supervisor approve/reject actions | `src/features/approvals/ReviewApprovalModal.tsx` | `POST /{caseId}/verification-decisions/{decisionId}/approval` | **FULLY IMPLEMENTED** | Payload and semantics match: APPROVED endorses/finalizes the analyst recommendation; REJECTED returns it to `IN_REVIEW`. Both high-risk APPROVE and REJECT recommendations require supervisor approval in backend. |
| Separation of duties | `src/features/approvals/ReviewApprovalModal.tsx` | Same approval endpoint | **FULLY IMPLEMENTED** | UI disables self-review; backend also forbids submitter approval. |
| Case closure | `src/features/cases/CaseDetailPage.tsx` | `POST /api/v1/kyc/cases/{caseId}/close` | **FULLY IMPLEMENTED** | UI prompts and only exposes for supervisor on APPROVED/REJECTED; backend enforces supervisor and final-state precondition. |
| Raw audit event browsing | `src/features/cases/CaseDetailPage.tsx` | No audit-query API found | **NOT IMPLEMENTED** | The backend records audit events internally but exposes no endpoint for an audit feed. Status/assignment histories are not the raw audit event log. |
| API client administration | `src/features/dashboard/DashboardPage.tsx` | No client/reference-administration API found | **NOT IMPLEMENTED** | Admin role is recognized and safely shown an explanatory page; actual management is not supported by backend endpoints. |
| Validation, loading, and error UX | Shared UI and feature pages | Spring validation/ProblemDetail responses | **PARTIALLY IMPLEMENTED** | Common controls exist and most mutations show server errors. Some page errors are generic, profile errors only log to console, and case detail silently ignores several failed reads. |
| Backend catalogue discovery | `src/features/verification/AddCheckModal.tsx`, `src/features/verification/DecisionModal.tsx` | No catalogue endpoint found | **PARTIALLY IMPLEMENTED** | Frontend environment/default values mirror current backend defaults but can drift from deployment configuration; server validation will reject unsupported check types. |
| Actual live frontend/backend workflow | All listed features | Local API at port 8080 | **UNVERIFIED** | Backend port 8080 was not reachable during the audit. Build/tests do not prove runtime API behavior. |

### Implementation totals

Counts are mutually exclusive across the 36 matrix rows:

| Status | Count |
|---|---:|
| Fully implemented | 18 |
| Partially implemented | 14 |
| UI only | 0 |
| Backend mismatch | 1 |
| Not implemented | 2 |
| Unverified | 1 |

## 4. API mapping report

| Frontend service/action | Backend controller and endpoint | Request / response mapping | Authorization and result |
|---|---|---|---|
| `AuthContext` login/logout/current user; `csrf.ts` | `AuthController`: `GET /api/v1/auth/csrf`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` | Login request `{email,password}`; user response `{id,email,displayName,roles}`; CSRF response `{headerName,token}`. Cookie is browser-managed. | Login/CSRF public; logout/me authenticated. Request/response shapes match. CSRF header is hardcoded in client. |
| Customer list/create/read/update (`CustomersPage`, customer modals, profile) | `CustomerController`: `GET/POST /api/v1/customers`, `GET/PATCH /api/v1/customers/{customerId}` | Create `{displayName,email}`; update optional `{displayName,email}`; list is `PageResponse<CustomerResponse>`. | CUSTOMER sees owner records and may create/update own record; analyst scope follows assigned cases; supervisor has broader scope. API methods/DTOs match. |
| Customer’s cases (`CustomerDetailPage`) | `CustomerCaseController`: `GET /api/v1/customers/{customerId}/cases?page&size` | `PageResponse<CaseResponse>` | Owner-scoped for CUSTOMER, assignment-scoped for analyst, broader supervisor access. Matches. |
| Case list/create/detail/edit/close/assign (`CasesPage`, modals, `CaseDetailPage`) | `KycCaseController`: `GET/POST /api/v1/kyc/cases`, `GET/PATCH /api/v1/kyc/cases/{caseId}`, `POST /{caseId}/assignments`, `GET /{caseId}/assignments`, `POST /{caseId}/close` | Create `{customerId,caseType,riskLevel,priority}`; update `{riskLevel?,priority?,status?}` (status must remain absent); assignment `{analystUserId}`; case/assignment response fields align. | Customer creation tied to own customer; analysts see assigned cases; supervisors see/assign/close within backend rules. Paths and DTOs match. |
| Status and workflow history (`CaseDetailPage`, timeline) | `KycCaseController`: `GET /{caseId}/status`, `GET /{caseId}/status/history` | Case response and `StatusHistoryResponse[]` | Status read is scoped; history requires staff and assigned analyst/supervisor scope. Customer UI currently requests the staff-only history endpoint. |
| Review and checks (`VerificationTab`, `AddCheckModal`) | `POST /{caseId}/review/start`, `POST/GET /{caseId}/verification-checks` | Check create `{checkType,result,notes?,documentId?}`; responses match `CheckResponse`. | Assigned analyst; supervisor access for supported oversight/check operations. Backend checks status and supported catalogue. Matches. |
| Decisions (`DecisionModal`, decision history) | `POST /{caseId}/verification-results`, `GET /{caseId}/verification-decisions` | `{outcome,reasonCode,rationale?}` plus optional idempotency header; response aligns with `DecisionResponse`. | Assigned analyst submits; high-risk APPROVE and REJECT need supervisor approval; `NEEDS_INFORMATION` does not. Matches. |
| Supervisor approvals (`ApprovalsPage`, `ReviewApprovalModal`) | `GET /{caseId}/approvals/pending`, `POST /{caseId}/verification-decisions/{decisionId}/approval` | Review `{outcome: APPROVED|REJECTED,reason?}`; response includes review fields. | Supervisor only; backend prevents self-approval. Each evidence request has loading/success/empty/error UI, retry, and unavailable evidence blocks the review action. |
| Documents (`DocumentTable`, upload/review/version modals) | `DocumentController`: `POST/GET /api/v1/kyc/cases/{caseId}/documents`; `GET /{documentId}`; `GET /{documentId}/versions`; `POST /{documentId}/versions`; `PATCH /{documentId}/status`; `GET /{documentId}/download`; `GET /{documentId}/versions/{versionNumber}/content` | Multipart names are `documentType` and `file` for initial upload, `file` for versions; status update `{status}`; JSON/byte responses mapped to document types/blob. | Case/document ownership and role checks are server-side. Paths, methods, and field names align. |
| Audit event query | No frontend call and no backend audit controller/endpoint found | Not applicable | Not applicable | Audit recording exists server-side, but no UI access to raw audit events is available. |

## 5. Security audit

### Positive controls observed

- Session token is in an HttpOnly cookie; frontend uses credentialed requests and does not store auth tokens in `localStorage` or `sessionStorage`.
- CSRF token is explicitly fetched and sent on POST/PATCH/PUT/DELETE calls.
- Route role checks are present, while backend APIs independently enforce authenticated access, case assignment, customer ownership, supervisor-only actions, and separation of duties.
- Document APIs are nested under case IDs and backend services validate case/document association and role access.
- The only application `localStorage` use is the light/dark theme preference.
- No production workflow uses mocked successful API responses. Test suites mock `fetch`; the login page also includes local-demo autofill buttons, but submitting them still calls the real login API.

### Issues and limitations

- The API client retries every mutation 403 after refreshing CSRF, rather than distinguishing a CSRF failure from a role/ownership denial. This does not bypass backend authorization, but can repeat a denied request and produce confusing behavior.
- The initial audit found session recovery, case-detail read errors, supervisor evidence, and login demo controls needed improvement; these were addressed in Phase 5B (see section 9).
- The frontend’s role gates are not security controls. Live unauthenticated denial and missing-CSRF checks passed, but live cross-customer, cross-case, and authenticated role-denial requests were not run because no test user session was used.
- No CORS configuration was found; deployment must retain the documented same-origin/reverse-proxy arrangement for session cookies and CSRF.

## 6. UI/UX audit

- Existing screens cover dashboards, case/customer lists and details, documents, verification, supervisor approvals, and profile. Shared spinners, alerts, empty states, badges, tables, tabs, pagination, and modal components are used.
- Search/filtering on case and customer lists remains local to the current page and is now labeled as such.
- Dashboards now retrieve all available pages using response metadata; those requests scale with the number of pages because no backend aggregate endpoint exists.
- Supervisor approval evidence now has independent loading/success/empty/error states, retry, and an action gate.
- Customer case detail no longer calls staff-only verification/history/assignment endpoints and clearly explains that detailed status history is restricted.
- Assignment UI requires a manually known analyst UUID. No analyst chooser can be built from current API capabilities without a new backend endpoint or approved alternate source.
- Additional-information UX directs the customer to the case/document page, but provides no dedicated response action. The existing document upload/version flow is the available evidence-submission path.
- Initial and replacement document uploads share client-side size/type checks; no progress percentage is shown, and backend validation remains authoritative.
- There is no toast/notification system or global query-cache invalidation. The app relies on local error alerts and explicit reload callbacks; the touched profile, dashboard, case, and version-loading paths now surface errors and retry where appropriate.
- Profile shows a customer-specific view only for CUSTOMER; role/account details are read from authenticated `/me`.

## 7. Test and execution results

The following are the results from the initial discovery audit, before Phase 5B implementation. The updated Phase 5B results follow in section 9.

| Command | Result |
|---|---|
| `npm ls --depth=0` | Passed; declared dependencies are installed. |
| `npm run lint` | Passed; `tsc --noEmit` returned exit code 0. |
| `npm test` | Passed; 6 test files and **17 tests** passed. React Router emitted v7 future-flag warnings. |
| `npm run build` | Passed; TypeScript check and Vite 6.4.5 production build completed. |
| `backend/run-local.ps1` | Started Spring Boot successfully with Java 21.0.12.1. Flyway validated 5 migrations against the existing MySQL development schema at V5 and reported it up to date; no migration was applied. |
| `GET /api/v1/auth/csrf` | **HTTP 200**, `application/json`; response header name was `X-XSRF-TOKEN`. Token value and cookie value were deliberately omitted. |
| `GET /api/v1/auth/me` without a session | **HTTP 401**, `application/problem+json`, as expected for an unauthenticated request. |
| `GET /api/v1/kyc/cases` without a session | **HTTP 401**, `application/problem+json`, as expected for an unauthenticated request. No case data was returned. |
| `POST /api/v1/auth/logout` without CSRF/session | **HTTP 403**, as expected; request was rejected before logout. No authenticated session or customer mutation was used. |
| CSRF cookie attributes | Response included the CSRF cookie with `SameSite=Strict`; it was not HttpOnly, consistent with the double-submit token mechanism. Cookie value omitted. Session-cookie flags were not tested because no login was performed. |
| `GET /v3/api-docs` on local profile | **HTTP 200**; OpenAPI document contained 25 paths, including auth and KYC case paths. This verifies local docs only, not production docs being disabled. |
| CORS probe with `Origin: http://localhost:5173` | No `Access-Control-Allow-Origin` header. This matches the same-origin/Vite proxy setup; it does not verify a production proxy. |

The tests are frontend component/unit tests with stubbed fetch responses; they do not prove authenticated customer/analyst/supervisor workflows or MySQL workflow behavior. Live checks used direct HTTP requests to the local backend, not a browser session running the frontend. No login, write operation with a valid CSRF token, customer record, case, document upload, assignment, decision, or approval was created. The existing local MySQL schema was only validated at startup and left unchanged. No production-profile, HTTPS, or secure session-cookie runtime test was performed. No dependency installation was needed. No backend tests were run for this frontend-only audit.

## 8. Remaining limitations after Phase 5B

- Analyst assignment still requires a supervisor to know and type an analyst UUID. The backend exposes no eligible-analyst listing endpoint.
- There is no dedicated customer response/message endpoint for `NEEDS_INFORMATION`. The existing upload/version flow remains the available evidence-submission path; no endpoint was invented.
- Search/filtering on the case and customer lists is explicitly page-local; backend filtering is not available in the inspected API.
- Dashboards now load every page for accurate computed counts. No aggregate endpoint exists, so request volume scales with the number of pages.
- The API client still hardcodes the Spring CSRF header name and retries mutation `403` responses after refreshing CSRF. That behavior was not changed in this scope to avoid changing CSRF handling or backend authorization semantics.
- Client-side MIME/size checks improve upload UX only. Backend file validation remains authoritative.
- The UI changes were not tested against an authenticated live backend session. Prior live checks were read-only unauthenticated smoke checks; no workflow writes or customer data were used.
- Raw audit event viewing, a customer-visible status-history endpoint, analyst directory, workflow catalogue discovery, and a distinct customer response endpoint require backend support or an approved requirements decision.

## 9. Phase 5B implementation

### Issues fixed

1. **Supervisor evidence integrity:** case, customer, documents, verification checks, and status history each track loading/success/error independently. A successfully returned empty list is represented as empty; failed requests show their errors and a retry action. Approval/rejection remains disabled until all evidence requests succeed. The existing approval endpoint, self-approval prevention, and backend authorization are unchanged.
2. **Authentication recovery:** API 401 responses notify the auth provider, clear stale user/CSRF state, and cause protected routes to redirect to login. Startup network/5xx failures no longer become normal logout; unauthenticated protected pages show a recoverable error and session-check retry. Credential cookies and the existing CSRF request behavior remain intact.
3. **Customer status-history access:** CUSTOMER users do not request staff-only status history, checks, decisions, or assignments. Their status-information tab clearly says detailed history is staff-restricted. Staff access remains unchanged.
4. **Dashboard pagination:** analyst, supervisor, and customer dashboards use the existing `getAllPages` helper, which follows response metadata and normalizes malformed non-finite page counts. Dashboard errors now show actionable retry feedback instead of misleading zero totals.
5. **Search clarity:** case/customer list search and filters explicitly say they apply to the currently loaded page; filtered row counts are labeled as page-local.
6. **Replacement file validation:** replacement uploads use the same PDF/JPEG/PNG MIME checks and 10 MiB size limit as initial uploads. Backend validation remains the security boundary.
7. **Demo autofill:** demo identities and password autofill controls render only when `import.meta.env.DEV` is true.
8. **General state/error UX:** case-detail secondary read failures are visible as warnings rather than silently swallowed; case/profile/list/version failures offer retry or clear state. Version history distinguishes failed loading from a successful empty result.

### Files changed

- `src/features/approvals/ApprovalsPage.tsx`, `ReviewApprovalModal.tsx`, and new `reviewEvidence.ts`: evidence state, error display, retry, and decision gating.
- `src/lib/api/client.ts`, `src/lib/auth/AuthContext.tsx`, `src/components/shared/ProtectedRoute.tsx`: central 401 notification, stale-session clearing, and outage recovery.
- `src/features/cases/CaseDetailPage.tsx`, `CasesPage.tsx`, `src/features/customers/CustomersPage.tsx`: role-safe requests, visible detail errors, page-local search labels, and retry feedback.
- `src/features/dashboard/AnalystDashboard.tsx`, `SupervisorDashboard.tsx`, `CustomerDashboard.tsx`: metadata-driven all-page loading and surfaced errors.
- `src/features/documents/DocumentUploadModal.tsx`, `DocumentVersionsModal.tsx`, and new `documentUploadValidation.ts`: shared client-side file checks and version-load retry/empty states.
- `src/features/auth/LoginPage.tsx`, `src/features/profile/ProfilePage.tsx`: development-only demo controls and explicit profile load recovery.
- `src/tests/approvals.test.tsx`, `auth.test.tsx`, `documents.test.tsx`, `phase5b.test.tsx`, `setup.ts`: regression coverage and environment cleanup.
- `FRONTEND_BACKEND_AUDIT_REPORT.md`: this implementation and validation record.
- No backend source, endpoint, API contract, mock workflow, or dependency was added or changed.

### Tests added

- Failed supervisor evidence disables review; retry after a transient evidence failure restores the action.
- Authentication network failure remains visible and recoverable; confirmed API 401 clears the session and redirects.
- Customer case detail omits staff-only history/check requests.
- Dashboard pagination includes the next page using server metadata.
- Replacement uploads reject unsupported MIME types and files over 10 MiB.
- Demo autofill is absent when the production environment flag is false.

### Phase 5B validation results

Commands were run from `frontend/`:

| Command | Result |
|---|---|
| `npm run lint` | **Passed**; `tsc --noEmit` exited 0. |
| `npm test` | **Passed**; 7 test files, **26 tests passed**. React Router v7 future-flag and React `act(...)` warnings remain non-failing test output. |
| `npm run build` | **Passed**; TypeScript check and Vite 6.4.5 production build completed. |
| Production bundle demo-password check | **Passed**; `DemoPassword123!` was absent from the generated JavaScript assets. |
| `git diff --check` | **Passed**; no whitespace errors. |

An initial attempt to run npm commands from the repository root failed because `package.json` is in `frontend/`; all listed final commands were rerun from the correct directory. The production build completed, but it does not constitute live backend verification.

### Completion status

**Phase 5B frontend implementation: Complete.** The prioritized frontend fixes and requested regression coverage are implemented; lint, all 26 tests, and production build pass. **Live authenticated integration remains unverified.** No backend changes were required, and no live API workflow or write operation is claimed as tested. The pre-Phase-5B audit counts (18 fully implemented, 14 partially implemented, 1 backend mismatch, 2 not implemented, 1 unverified) are a discovery snapshot, not updated aggregate counts; the status-history mismatch has been resolved in the frontend without changing backend access rules.
