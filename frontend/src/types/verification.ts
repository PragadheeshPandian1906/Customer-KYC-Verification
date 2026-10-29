export type CheckResult = 'PASS' | 'FAIL' | 'NEEDS_INFORMATION' | 'NOT_APPLICABLE';

export type DecisionOutcome = 'APPROVE' | 'REJECT' | 'NEEDS_INFORMATION';

export type ApprovalOutcome = 'APPROVED' | 'REJECTED';

export interface CheckResponse {
  id: string;
  caseId: string;
  documentId: string | null;
  checkType: string;
  result: CheckResult;
  notes: string | null;
  performedByUserId: string;
  performedAt: string;
}

export interface CreateCheckRequest {
  checkType: string;
  result: CheckResult;
  notes?: string;
  documentId?: string;
}

export interface DecisionResponse {
  id: string;
  caseId: string;
  submittedByUserId: string;
  outcome: DecisionOutcome;
  reasonCode: string;
  rationale: string | null;
  approvalRequired: boolean;
  approvalOutcome: string; // "PENDING" | "NOT_REQUIRED" | "APPROVED" | "REJECTED"
  reviewedByUserId: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  submittedAt: string;
}

export interface SubmitDecisionRequest {
  outcome: DecisionOutcome;
  reasonCode: string;
  rationale?: string;
}

export interface ReviewDecisionRequest {
  outcome: ApprovalOutcome;
  reason?: string;
}
