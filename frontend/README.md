# Customer KYC Verification Frontend

React, TypeScript, and Vite frontend for the Spring Boot KYC verification API. The application uses same-origin `/api` requests through the Vite development proxy, backend session cookies/CSRF, backend-returned data, and role-aware routes. It does not implement a separate authentication provider or API mock layer.

## Start locally

1. Prepare and start the backend. Follow the root README's MySQL and local environment setup, create `backend/.env` from `backend/.env.example`, then run:

   ```powershell
   cd backend
   .\run-local.ps1
   ```

   The backend local launcher expects Java 21 and configured local MySQL, demo user passwords, and document-storage key. It starts Spring Boot on port 8080.

2. In another terminal, configure and start the frontend:

   ```bash
   cd frontend
   cp .env.example .env.local
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`. Vite proxies `/api` to `http://localhost:8080` by default. Set `VITE_API_BASE_URL` in `.env.local` only if the backend listens elsewhere; this value configures the development proxy and is not used to send cross-origin browser API calls. The optional `VITE_KYC_*` values mirror the backend workflow catalogue/defaults for displaying checklists; backend validation remains authoritative.

For a production bundle, run `npm run build`; serve `frontend/dist` behind the same origin as `/api` (or configure a tightly scoped same-origin reverse proxy). Do not expose backend secrets in frontend environment variables.

## Backend endpoint → role → frontend mapping

| Backend endpoint(s) | Backend-authorized roles / data scope | Frontend pages and components |
|---|---|---|
| `GET /api/v1/auth/csrf`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` | Public CSRF/login; authenticated current-user/logout | `/login`, `AuthContext`, protected route, header user menu. Browser manages the HttpOnly session cookie; CSRF token is sent on mutations. |
| `GET/POST /api/v1/customers`, `GET/PATCH /api/v1/customers/{customerId}` | Customer self-service is owner-scoped; analysts/supervisors receive staff-scoped capabilities as enforced by backend; API client admin has no unrestricted business access | Customer dashboard/profile, customer list/details, customer create/update modals. |
| `GET /api/v1/customers/{customerId}/cases` | Owner and permitted staff access enforced server-side | Customer case history. |
| `GET/POST /api/v1/kyc/cases`, `GET/PATCH /api/v1/kyc/cases/{caseId}`, `GET /status`, `GET /status/history` | CUSTOMER sees owned cases; KYC_ANALYST sees assigned cases; COMPLIANCE_SUPERVISOR has oversight, per backend service authorization | Customer and staff case queues, case detail, status badges and history timeline. |
| `POST /{caseId}/assignments`, `GET /{caseId}/assignments`, `POST /{caseId}/close` | Supervisor assignment/closure and scoped assignment visibility are enforced by backend | Case assignment dialog and close workflow on case detail. |
| `POST /{caseId}/review/start`, `POST /{caseId}/verification-checks`, `GET /{caseId}/verification-checks`, `POST /{caseId}/verification-results`, `GET /{caseId}/verification-decisions` | Assigned analysts can perform assigned workflow operations; supervisor access is limited to supported oversight operations; backend enforces role and case assignment | Case verification tab, review start, check form, decision form, verification and decision histories. |
| `GET /{caseId}/approvals/pending`, `POST /{caseId}/verification-decisions/{decisionId}/approval` | Supervisor review; backend enforces separation of duties | `/approvals`, supervisor evidence review modal and approval/rejection actions. Review presents case/customer, document metadata/download, verification checks and status history before enabling action. |
| `POST /api/v1/kyc/cases/{caseId}/documents`, `GET` list and `GET /{documentId}`, `POST /{documentId}/versions`, `GET /{documentId}/versions`, `PATCH /{documentId}/status`, `GET /{documentId}/download`, `GET /{documentId}/versions/{versionNumber}/content` | Customer-owned case access and analyst/supervisor document review are authorized by backend; exact operations are checked server-side | Case documents tab, upload, replacement/version history, reviewer status, authorized download. Storage paths and encryption details are never presented. |

The roles confirmed in backend source are `CUSTOMER`, `KYC_ANALYST`, `COMPLIANCE_SUPERVISOR`, and `API_CLIENT_ADMIN`. Client/reference administration endpoints are not implemented, so the admin role has no unrestricted business-data pages. Frontend role checks only improve navigation and UX; backend authorization is the security boundary.

## Current backend boundaries

- Customer profile and KYC case workflows are available. The API does not expose a separate activity/audit query endpoint for arbitrary frontend audit timelines; the frontend uses supported case status and decision history instead.
- There is no backend endpoint to enumerate the required verification-check/document catalogue. Optional `VITE_KYC_*` values control display only; backend defaults/configuration and validation remain authoritative.
- Additional-information requests are represented by the decision and `NEEDS_INFORMATION` case state. There is no separate free-form response endpoint; customers can use supported case/document operations where permitted.
- No separate customer profile endpoint or aggregate dashboard endpoint exists; dashboards use the caller's authorized paginated customer/case results rather than fabricated counters.

## Quality checks

```bash
npm run lint
npm test
npm run build
```
