import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { ApprovalOutcome, CheckResponse, DecisionResponse } from '@/types/verification';
import { CaseResponse, StatusHistoryResponse } from '@/types/case';
import { CustomerResponse } from '@/types/customer';
import { DocumentResponse } from '@/types/document';
import { DocumentStatusBadge } from '@/components/shared/DocumentStatusBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RiskBadge } from '@/components/shared/RiskBadge';
import { StatusTimeline } from '@/components/shared/StatusTimeline';
import { formatDate, formatBytes } from '@/lib/utils';
import { Download, CheckCircle2, XCircle } from 'lucide-react';
import { extractErrorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthContext';

interface ReviewApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  decision: DecisionResponse | null;
  caseData: CaseResponse | null;
  customer: CustomerResponse | null;
  documents: DocumentResponse[];
  checks: CheckResponse[];
  history: StatusHistoryResponse[];
  isLoadingReview: boolean;
  onSuccess: (updatedDecision: DecisionResponse) => void;
}

export function ReviewApprovalModal({
  isOpen,
  onClose,
  caseId,
  decision,
  caseData,
  customer,
  documents,
  checks,
  history,
  isLoadingReview,
  onSuccess,
}: ReviewApprovalModalProps) {
  const { user } = useAuth();
  const [outcome, setOutcome] = useState<ApprovalOutcome>('APPROVED');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (!decision) return null;

  const downloadDocument = async (document: DocumentResponse) => {
    setDownloadingId(document.id);
    setError(null);
    try {
      const { blob, filename } = await api.download(
        `/api/v1/kyc/cases/${caseId}/documents/${document.id}/download`
      );
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(extractErrorMessage(downloadError));
    } finally {
      setDownloadingId(null);
    }
  };

  const isSelfSubmitter = decision.submittedByUserId === user?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (outcome === 'REJECTED' && !reason.trim()) {
      setError('A reason is mandatory when rejecting a submitted decision');
      return;
    }

    if (isSelfSubmitter) {
      setError('Separation of duties violation: A decision submitter cannot approve their own decision');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post<DecisionResponse>(
        `/api/v1/kyc/cases/${caseId}/verification-decisions/${decision.id}/approval`,
        {
          outcome,
          reason: reason.trim() || undefined,
        }
      );
      onSuccess(res);
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Supervisor Decision Review"
      description="Independent compliance review of an analyst's high-risk recommendation."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={outcome === 'APPROVED' ? 'success' : 'danger'}
            size="sm"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={isSelfSubmitter || isLoadingReview || !caseData}
            leftIcon={
              outcome === 'APPROVED' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />
            }
          >
            Confirm Review
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {isSelfSubmitter && (
        <Alert variant="warning" className="mb-4">
          <strong>Separation of Duties Notice:</strong> You originally submitted this decision recommendation. Under compliance policy, another authorized supervisor must perform this approval.
        </Alert>
      )}

      <div className="space-y-4">
        {isLoadingReview && <p role="status" className="text-xs text-slate-500">Loading case evidence...</p>}
        {caseData && (
          <section aria-label="Case being reviewed" className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="mr-auto text-sm font-semibold">{caseData.caseReference}</h3>
              <StatusBadge status={caseData.status} />
              <RiskBadge risk={caseData.riskLevel} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Customer: {customer?.displayName || caseData.customerId} {customer?.email ? `· ${customer.email}` : ''}
            </p>
            <p className="text-xs text-slate-500">Created {formatDate(caseData.createdAt)} · Updated {formatDate(caseData.updatedAt)}</p>
            <div>
              <h4 className="mb-2 text-xs font-semibold">Documents ({documents.length})</h4>
              {documents.length ? <ul className="space-y-2">{documents.map((document) => (
                <li key={document.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 p-2 text-xs">
                  <span className="font-medium">{document.documentType}</span>
                  <DocumentStatusBadge status={document.status} />
                  <span className="min-w-0 flex-1 truncate" title={document.filename}>{document.filename} · {formatBytes(document.size)}</span>
                  <Button type="button" variant="outline" size="sm" isLoading={downloadingId === document.id} onClick={() => downloadDocument(document)} leftIcon={<Download className="h-3.5 w-3.5" />}>Download</Button>
                </li>
              ))}</ul> : <p className="text-xs text-slate-500">No documents were returned for this case.</p>}
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold">Verification checks ({checks.length})</h4>
              {checks.length ? <ul className="space-y-1">{checks.map((check) => (
                <li key={check.id} className="text-xs">{check.checkType}: <strong>{check.result}</strong>{check.notes ? ` — ${check.notes}` : ''}</li>
              ))}</ul> : <p className="text-xs text-slate-500">No verification checks were returned for this case.</p>}
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold">Case status history</h4>
              <StatusTimeline history={history} currentStatus={caseData.status} />
            </div>
          </section>
        )}
        {!caseData && <Alert variant="warning">Case evidence could not be loaded. Refresh the approval queue before reviewing this decision.</Alert>}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
          <p>
            <strong className="text-slate-700 dark:text-slate-300">Analyst Recommendation:</strong>{' '}
            <span className="font-bold text-blue-600">{decision.outcome}</span> ({decision.reasonCode})
          </p>
          <p>
            <strong className="text-slate-700 dark:text-slate-300">Analyst Submitter:</strong>{' '}
            {decision.submittedByUserId}
          </p>
          {decision.rationale && (
            <p>
              <strong className="text-slate-700 dark:text-slate-300">Rationale:</strong>{' '}
              {decision.rationale}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Select
            label="Supervisor Action"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as ApprovalOutcome)}
            options={[
              {
                value: 'APPROVED',
                label: 'APPROVED — Endorse analyst recommendation (Finalizes case status)',
              },
              {
                value: 'REJECTED',
                label: 'REJECTED — Reject recommendation (Returns case to IN_REVIEW)',
              },
            ]}
            disabled={isLoading || isSelfSubmitter}
          />

          <Textarea
            label={`Supervisor Review Notes ${outcome === 'REJECTED' ? '(Required)' : '(Optional)'}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              outcome === 'REJECTED'
                ? 'State the reason for rejecting this recommendation and returning to review...'
                : 'Observations or endorsement notes...'
            }
            maxLength={1000}
            rows={3}
            required={outcome === 'REJECTED'}
            disabled={isLoading || isSelfSubmitter}
          />
        </form>
      </div>
    </Modal>
  );
}
