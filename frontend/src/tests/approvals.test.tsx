import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewApprovalModal } from '@/features/approvals/ReviewApprovalModal';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { DecisionResponse } from '@/types/verification';
import { CaseResponse } from '@/types/case';

describe('Supervisor Approvals', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockCase: CaseResponse = {
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

  const mockDecision: DecisionResponse = {
    id: 'dec-1',
    caseId: 'case-1',
    submittedByUserId: 'analyst-1',
    outcome: 'APPROVE',
    reasonCode: 'CHECKS_COMPLETE',
    rationale: 'All checks passed',
    approvalRequired: true,
    approvalOutcome: 'PENDING',
    reviewedByUserId: null,
    reviewReason: null,
    reviewedAt: null,
    submittedAt: new Date().toISOString(),
  };

  it('allows supervisor to approve recommendation and calls approval endpoint', async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'token' }),
        });
      }
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: 'supervisor-1',
              email: 'supervisor@example.test',
              displayName: 'Fictional Supervisor',
              roles: ['COMPLIANCE_SUPERVISOR'],
            }),
        });
      }
      if (url.includes('/approval')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ...mockDecision,
              approvalOutcome: 'APPROVED',
              reviewedByUserId: 'supervisor-1',
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    render(
      <AuthProvider>
        <ReviewApprovalModal
          isOpen={true}
          onClose={mockClose}
          caseId="case-1"
          decision={mockDecision}
          caseData={mockCase}
          customer={null}
          documents={[]}
          checks={[]}
          history={[]}
          isLoadingReview={false}
          onSuccess={mockSuccess}
        />
      </AuthProvider>
    );

    const submitBtn = screen.getByRole('button', { name: /Confirm Review/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ approvalOutcome: 'APPROVED' })
      );
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it('mandates a reason when supervisor selects REJECTED', async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'token' }),
        });
      }
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: 'supervisor-1',
              email: 'supervisor@example.test',
              displayName: 'Fictional Supervisor',
              roles: ['COMPLIANCE_SUPERVISOR'],
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    render(
      <AuthProvider>
        <ReviewApprovalModal
          isOpen={true}
          onClose={mockClose}
          caseId="case-1"
          decision={mockDecision}
          caseData={mockCase}
          customer={null}
          documents={[]}
          checks={[]}
          history={[]}
          isLoadingReview={false}
          onSuccess={mockSuccess}
        />
      </AuthProvider>
    );

    const outcomeSelect = screen.getByLabelText(/Supervisor Action/i);
    fireEvent.change(outcomeSelect, { target: { value: 'REJECTED' } });

    const submitBtn = screen.getByRole('button', { name: /Confirm Review/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/A reason is mandatory when rejecting a submitted decision/i)
    ).toBeInTheDocument();
  });
});
