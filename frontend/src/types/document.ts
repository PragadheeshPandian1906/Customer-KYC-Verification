export type DocumentStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED';

export interface DocumentResponse {
  id: string;
  caseId: string;
  documentType: string;
  status: DocumentStatus;
  currentVersion: number;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionResponse {
  id: string;
  version: number;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export interface DocumentStatusUpdateRequest {
  status: DocumentStatus;
}
