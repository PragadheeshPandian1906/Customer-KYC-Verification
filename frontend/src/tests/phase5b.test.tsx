import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { CaseDetailPage } from '@/features/cases/CaseDetailPage';
import { AnalystDashboard } from '@/features/dashboard/AnalystDashboard';
import { CaseResponse } from '@/types/case';
import { DecisionResponse } from '@/types/verification';

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers({ 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' }),
  json: () => Promise.resolve(body),
});

const caseData: CaseResponse = {
  id: 'case-1',
  caseReference: 'KYC-0001',
  customerId: 'customer-1',
  caseType: 'INDIVIDUAL',
  status: 'PENDING_SUPERVISOR_APPROVAL',
  riskLevel: 'HIGH',
  priority: 'HIGH',
  assignedToUserId: 'analyst-1',
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const decision: DecisionResponse = {
  id: 'decision-1',
  caseId: caseData.id,
  submittedByUserId: 'analyst-1',
  outcome: 'APPROVE',
  reasonCode: 'CHECKS_COMPLETE',
  rationale: 'All checks are complete.',
  approvalRequired: true,
  approvalOutcome: 'PENDING',
  reviewedByUserId: null,
  reviewReason: null,
  reviewedAt: null,
  submittedAt: new Date().toISOString(),
};

const page = (content: CaseResponse[], pageNumber: number, totalPages: number) => ({
  content,
  page: pageNumber,
  size: 100,
  totalElements: 2,
  totalPages,
  first: pageNumber === 0,
  last: pageNumber === totalPages - 1,
});

describe('Phase 5B regressions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks supervisor review after evidence failure and permits retry when evidence recovers', async () => {
    let documentRequests = 0;
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/auth/csrf')) return Promise.resolve(jsonResponse({ headerName: 'X-XSRF-TOKEN', token: 'csrf' }));
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve(jsonResponse({
          id: 'supervisor-1',
          email: 'supervisor@example.test',
          displayName: 'Fictional Supervisor',
          roles: ['COMPLIANCE_SUPERVISOR'],
        }));
      }
      if (url.includes('/api/v1/kyc/cases?page=0')) {
        return Promise.resolve(jsonResponse(page([caseData], 0, 1)));
      }
      if (url.includes('/approvals/pending')) return Promise.resolve(jsonResponse([decision]));
      if (url.endsWith('/api/v1/kyc/cases/case-1')) return Promise.resolve(jsonResponse(caseData));
      if (url.includes('/api/v1/customers/customer-1')) {
        return Promise.resolve(jsonResponse({
          id: 'customer-1',
          displayName: 'Fictional Customer',
          email: 'customer@example.test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      }
      if (url.endsWith('/documents')) {
        documentRequests += 1;
        return documentRequests === 1
          ? Promise.resolve(jsonResponse({ status: 503, title: 'Unavailable', detail: 'Document service offline' }, 503))
          : Promise.resolve(jsonResponse([]));
      }
      if (url.endsWith('/verification-checks') || url.endsWith('/status/history')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    render(
      <MemoryRouter>
        <AuthProvider><ApprovalsPage /></AuthProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /Review Decision/i }));
    expect(await screen.findByText(/Documents unavailable: Document service offline/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Review/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Retry evidence loading/i }));
    await waitFor(() => {
      expect(documentRequests).toBe(2);
      expect(screen.getByRole('button', { name: /Confirm Review/i })).toBeEnabled();
    });
  });

  it('does not request staff-only status history for customer case details', async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes('/api/v1/auth/csrf')) return Promise.resolve(jsonResponse({ headerName: 'X-XSRF-TOKEN', token: 'csrf' }));
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve(jsonResponse({
          id: 'customer-user',
          email: 'customer@example.test',
          displayName: 'Fictional Customer',
          roles: ['CUSTOMER'],
        }));
      }
      if (url.endsWith('/api/v1/kyc/cases/case-1')) return Promise.resolve(jsonResponse(caseData));
      if (url.includes('/api/v1/customers/customer-1')) {
        return Promise.resolve(jsonResponse({
          id: 'customer-1',
          displayName: 'Fictional Customer',
          email: 'customer@example.test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      }
      if (url.endsWith('/documents')) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`Unexpected customer request: ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/cases/case-1']}>
        <AuthProvider>
          <Routes><Route path="/cases/:caseId" element={<CaseDetailPage />} /></Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /Status Information/i }));
    expect(await screen.findByText(/Detailed status history is restricted to authorized staff/i)).toBeInTheDocument();
    expect(requestedUrls.some((url) => url.includes('/status/history'))).toBe(false);
    expect(requestedUrls.some((url) => url.includes('/verification-checks'))).toBe(false);
  });

  it('uses pagination metadata to include cases from subsequent dashboard pages', async () => {
    const firstCase = { ...caseData, id: 'case-1', caseReference: 'KYC-0001', status: 'DRAFT' as const };
    const secondCase = { ...caseData, id: 'case-2', caseReference: 'KYC-0002', status: 'IN_REVIEW' as const };
    const requestedUrls: string[] = [];
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes('page=0')) return Promise.resolve(jsonResponse(page([firstCase], 0, 2)));
      if (url.includes('page=1')) return Promise.resolve(jsonResponse(page([secondCase], 1, 2)));
      return Promise.reject(new Error(`Unexpected dashboard request: ${url}`));
    });

    render(
      <MemoryRouter><AnalystDashboard /></MemoryRouter>
    );

    expect(await screen.findByText('KYC-0002')).toBeInTheDocument();
    expect(screen.getByText('Active Review Queue (2)')).toBeInTheDocument();
    expect(requestedUrls.some((url) => url.includes('page=1'))).toBe(true);
  });
});
