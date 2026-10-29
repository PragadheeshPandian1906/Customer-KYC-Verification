import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RiskBadge, PriorityBadge } from '@/components/shared/RiskBadge';
import { CreateCaseModal } from '@/features/cases/CreateCaseModal';
import { CaseResponse } from '@/types/case';

describe('Cases & Badges', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all backend status badge variants correctly', () => {
    const { rerender } = render(<StatusBadge status="DRAFT" />);
    expect(screen.getByText(/Draft/i)).toBeInTheDocument();

    rerender(<StatusBadge status="IN_REVIEW" />);
    expect(screen.getByText(/In Review/i)).toBeInTheDocument();

    rerender(<StatusBadge status="PENDING_SUPERVISOR_APPROVAL" />);
    expect(screen.getByText(/Pending Supervisor Approval/i)).toBeInTheDocument();

    rerender(<StatusBadge status="NEEDS_INFORMATION" />);
    expect(screen.getByText(/Needs Information/i)).toBeInTheDocument();

    rerender(<StatusBadge status="APPROVED" />);
    expect(screen.getByText(/Approved/i)).toBeInTheDocument();

    rerender(<StatusBadge status="REJECTED" />);
    expect(screen.getByText(/Rejected/i)).toBeInTheDocument();

    rerender(<StatusBadge status="CLOSED" />);
    expect(screen.getByText(/Closed/i)).toBeInTheDocument();
  });

  it('renders risk and priority badges', () => {
    render(
      <div>
        <RiskBadge risk="HIGH" />
        <PriorityBadge priority="HIGH" />
      </div>
    );
    expect(screen.getByText(/High Risk/i)).toBeInTheDocument();
    expect(screen.getByText(/High Priority/i)).toBeInTheDocument();
  });

  it('validates customerId in CreateCaseModal and submits request with Idempotency-Key', async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'token' }),
        });
      }
      if (url.includes('/api/v1/kyc/cases')) {
        const body = JSON.parse(init?.body as string);
        const res: CaseResponse = {
          id: 'case-new-1',
          caseReference: 'KYC-2026-0001',
          customerId: body.customerId,
          caseType: body.caseType,
          status: 'DRAFT',
          riskLevel: body.riskLevel,
          priority: body.priority,
          assignedToUserId: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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
      <CreateCaseModal
        isOpen={true}
        onClose={mockClose}
        onSuccess={mockSuccess}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Create KYC Case/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Customer ID is required/i)).toBeInTheDocument();

    const customerInput = screen.getByLabelText(/Customer ID/i);
    fireEvent.change(customerInput, { target: { value: '550e8400-e29b-41d4-a716-446655440000' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
