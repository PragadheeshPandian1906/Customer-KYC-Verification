import { CaseResponse, StatusHistoryResponse } from '@/types/case';
import { CustomerResponse } from '@/types/customer';
import { DocumentResponse } from '@/types/document';
import { CheckResponse } from '@/types/verification';

export type EvidenceState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

export interface ReviewEvidence {
  caseData: EvidenceState<CaseResponse>;
  customer: EvidenceState<CustomerResponse>;
  documents: EvidenceState<DocumentResponse[]>;
  checks: EvidenceState<CheckResponse[]>;
  history: EvidenceState<StatusHistoryResponse[]>;
}
