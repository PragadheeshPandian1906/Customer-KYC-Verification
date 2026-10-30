import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssignCaseModal } from '@/features/cases/AssignCaseModal';
import { CaseCommunicationsTab, CaseCommunication } from '@/features/cases/CaseCommunicationsTab';
import { AuditEventsPage } from '@/features/audit/AuditEventsPage';
import { CaseResponse } from '@/types/case';
import { DocumentResponse } from '@/types/document';
import { clearCsrfToken } from '@/lib/api/csrf';

const authState = vi.hoisted(() => ({ isCustomer: true }));
vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({ isCustomer: authState.isCustomer }),
}));

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status >= 400 ? 'Error' : 'OK',
  headers: new Headers({ 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' }),
  json: () => Promise.resolve(body),
});

const caseData: CaseResponse = {
  id: 'case-5d',
  caseReference: 'KYC-5D',
  customerId: 'customer-5d',
  caseType: 'INDIVIDUAL',
  status: 'NEEDS_INFORMATION',
  riskLevel: 'LOW',
  priority: 'NORMAL',
  assignedToUserId: 'analyst-5d',
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const document: DocumentResponse = {
  id: 'document-5d',
  caseId: caseData.id,
  documentType: 'ADDRESS_EVIDENCE',
  status: 'PENDING_REVIEW',
  currentVersion: 1,
  filename: 'address.pdf',
  contentType: 'application/pdf',
  size: 100,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const informationRequest: CaseCommunication = {
  id: 'request-5d',
  type: 'INFORMATION_REQUEST',
  senderRole: 'KYC_ANALYST',
  senderDisplayName: 'Fictional Analyst',
  message: 'Please provide proof of address.',
  parentCommunicationId: null,
  sourceDecisionId: 'decision-5d',
  documents: [],
  createdAt: '2026-01-01T00:00:00Z',
};

describe('Phase 5D frontend integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCsrfToken();
    authState.isCustomer = true;
  });

  it('loads the analyst directory and assigns by the selected directory entry', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/api/v1/auth/csrf')) {
        return Promise.resolve(jsonResponse({ headerName: 'X-XSRF-TOKEN', token: 'csrf-token' }));
      }
      if (String(input).includes('/assignments')) {
        return Promise.resolve(jsonResponse([{
          id: 'assignment-1',
          analystUserId: 'analyst-1',
          assignedByUserId: 'supervisor-1',
          analystDisplayName: 'Fictional Analyst',
          assignedAt: '2026-01-01T00:00:00Z',
          endedAt: null,
        }]));
      }
      return Promise.resolve(jsonResponse({
        content: [{ id: 'analyst-1', displayName: 'Fictional Analyst' }],
        page: 0,
        size: 50,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      }));
    });
    global.fetch = fetchMock;
    const onSuccess = vi.fn();

    render(
      <AssignCaseModal isOpen onClose={vi.fn()} caseId={caseData.id}
        onSuccess={onSuccess} />
    );

    await screen.findByRole('option', { name: 'Fictional Analyst' });
    fireEvent.change(screen.getByLabelText('Active KYC analyst'), {
      target: { value: 'analyst-1' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Confirm Assignment/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/kyc/cases/${caseData.id}/assignments`,
        expect.objectContaining({ method: 'POST' })
      );
    });
    const assignmentCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/assignments'));
    expect(JSON.parse(String(assignmentCall?.[1]?.body))).toEqual({ analystUserId: 'analyst-1' });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('submits a customer response linked to the requested message and selected case document', async () => {
    let responseCalls = 0;
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/api/v1/auth/csrf')) {
        return Promise.resolve(jsonResponse({ headerName: 'X-XSRF-TOKEN', token: 'csrf-token' }));
      }
      responseCalls += 1;
      return Promise.resolve(jsonResponse({
        ...informationRequest,
        id: 'response-5d',
        type: 'CUSTOMER_RESPONSE',
        parentCommunicationId: informationRequest.id,
        sourceDecisionId: null,
      }, 201));
    });
    global.fetch = fetchMock;
    const onDataChange = vi.fn();

    render(
      <CaseCommunicationsTab caseData={caseData} documents={[document]}
        communications={[informationRequest]} onDataChange={onDataChange} />
    );
    fireEvent.change(screen.getByLabelText(/Your response/), {
      target: { value: 'I attached my current statement.' },
    });
    fireEvent.click(screen.getByLabelText(/ADDRESS_EVIDENCE: address.pdf/i));
    fireEvent.click(screen.getByRole('button', { name: /Send response/i }));

    await waitFor(() => expect(responseCalls).toBe(1));
    const request = fetchMock.mock.calls.find(([url]) => String(url).includes('/communications/responses'));
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      requestId: informationRequest.id,
      message: 'I attached my current statement.',
      documentIds: [document.id],
    });
    expect(onDataChange).toHaveBeenCalled();
  });

  it('shows audit event paging and filters from the read-only API', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      content: [{
        id: 'audit-1',
        actorUserId: 'admin-1',
        actorRole: 'API_CLIENT_ADMIN',
        eventType: 'KYC_CASE_READ',
        resourceType: 'KYC_CASE',
        resourceId: 'case-1',
        outcome: 'SUCCESS',
        createdAt: '2026-01-01T00:00:00Z',
      }],
      page: 0,
      size: 50,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    }));

    render(<AuditEventsPage />);
    expect(await screen.findByText('KYC_CASE_READ')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'KYC_CASE_READ' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('eventType=KYC_CASE_READ'),
      expect.objectContaining({ method: 'GET' })
    ));
  });
});
