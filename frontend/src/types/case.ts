export type CaseType = 'INDIVIDUAL' | 'BUSINESS';

export type CaseStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'PENDING_SUPERVISOR_APPROVAL'
  | 'NEEDS_INFORMATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type Priority = 'LOW' | 'NORMAL' | 'HIGH';

export interface CaseResponse {
  id: string;
  caseReference: string;
  customerId: string;
  caseType: CaseType;
  status: CaseStatus;
  riskLevel: RiskLevel;
  priority: Priority;
  assignedToUserId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseRequest {
  customerId: string;
  caseType: CaseType;
  riskLevel: RiskLevel;
  priority: Priority;
}

export interface UpdateCaseRequest {
  riskLevel?: RiskLevel;
  priority?: Priority;
}

export interface AssignmentRequest {
  analystUserId: string;
}

export interface AssignmentResponse {
  id: string;
  analystUserId: string;
  assignedByUserId: string;
  assignedAt: string;
  endedAt: string | null;
}

export interface StatusHistoryResponse {
  id: string;
  fromStatus: CaseStatus;
  toStatus: CaseStatus;
  changedByUserId: string;
  reasonCode: string | null;
  changedAt: string;
}
