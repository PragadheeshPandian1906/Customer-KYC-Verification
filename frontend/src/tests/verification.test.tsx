import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddCheckModal } from '@/features/verification/AddCheckModal';
import { DecisionModal } from '@/features/verification/DecisionModal';
import { CaseResponse } from '@/types/case';
import { CheckResponse } from '@/types/verification';

describe('Verification Checks and Analyst Decisions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockCase: CaseResponse = {
    id: 'case-1',
    caseReference: 'KYC-2026-0001',
    customerId: 'cust-1',
    caseType: 'INDIVIDUAL',
    status: 'IN_REVIEW',
    riskLevel: 'HIGH',
    priority: 'HIGH',
    assignedToUserId: 'analyst-1',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('submits a verification check record with checkType and result', async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'token' }),
        });
      }
      if (url.includes('/verification-checks')) {
        const body = JSON.parse(init?.body as string);
        const res: CheckResponse = {
          id: 'chk-1',
          caseId: 'case-1',
          documentId: null,
          checkType: body.checkType,
          result: body.result,
          notes: body.notes || null,
          performedByUserId: 'analyst-1',
          performedAt: new Date().toISOString(),
        };
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(res),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    render(
      <AddCheckModal
        isOpen={true}
        onClose={mockClose}
        caseId="case-1"
        documents={[]}
        onSuccess={mockSuccess}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Submit Check/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          checkType: 'CUSTOMER_INFORMATION',
          result: 'PASS',
        })
      );
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it('enforces rationale requirement when submitting NEEDS_INFORMATION recommendation', async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();

    render(
      <DecisionModal
        isOpen={true}
        onClose={mockClose}
        caseData={mockCase}
        documents={[]}
        checks={[]}
        onSuccess={mockSuccess}
      />
    );

    const outcomeSelect = screen.getByLabelText(/Decision Outcome/i);
    fireEvent.change(outcomeSelect, { target: { value: 'NEEDS_INFORMATION' } });

    const submitBtn = screen.getByRole('button', { name: /Submit Decision/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/A rationale is mandatory when requesting additional information/i)
    ).toBeInTheDocument();
  });
});
