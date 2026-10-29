import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { DecisionOutcome, DecisionResponse, CheckResponse } from '@/types/verification';
import { CaseResponse } from '@/types/case';
import { DocumentResponse } from '@/types/document';
import { extractErrorMessage } from '@/lib/api/errors';
import { generateIdempotencyKey } from '@/lib/utils';
import { ShieldAlert, Send } from 'lucide-react';

interface DecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: CaseResponse;
  documents: DocumentResponse[];
  checks: CheckResponse[];
  onSuccess: (newDecision: DecisionResponse) => void;
}

export function DecisionModal({
  isOpen,
  onClose,
  caseData,
  documents,
  checks,
  onSuccess,
}: DecisionModalProps) {
  const [outcome, setOutcome] = useState<DecisionOutcome>('APPROVE');
  const [reasonCode, setReasonCode] = useState('CHECKS_COMPLETE');
  const [rationale, setRationale] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analyze readiness
  const latestCheckMap = new Map<string, string>();
  checks.forEach((c) => {
    latestCheckMap.set(c.checkType, c.result);
  });

  const mandatoryCheckTypes = (import.meta.env.VITE_KYC_REQUIRED_CHECK_TYPES ||
    'CUSTOMER_INFORMATION,IDENTITY_DOCUMENT,ADDRESS_DOCUMENT')
    .split(',')
    .map((type: string) => type.trim())
    .filter(Boolean);
  const requiredDocumentTypes = (import.meta.env.VITE_KYC_REQUIRED_DOCUMENT_TYPES || 'IDENTITY_EVIDENCE')
    .split(',')
    .map((type: string) => type.trim())
    .filter(Boolean);
  const allChecksPass = mandatoryCheckTypes.length > 0 &&
    mandatoryCheckTypes.every((t: string) => latestCheckMap.get(t) === 'PASS');
  const allChecksDone = mandatoryCheckTypes.length > 0 && mandatoryCheckTypes.every(
    (t: string) => latestCheckMap.has(t) && latestCheckMap.get(t) !== 'NEEDS_INFORMATION'
  );

  const requiredDocs = requiredDocumentTypes.map((type) => ({
    type,
    document: documents.find((doc) => doc.documentType === type),
  }));
  const allRequiredDocsAccepted = requiredDocs.length > 0 &&
    requiredDocs.every(({ document }: { document: DocumentResponse | undefined }) => document?.status === 'ACCEPTED');
  const allRequiredDocsReviewed = requiredDocs.length > 0 && requiredDocs.every(
    ({ document }: { document: DocumentResponse | undefined }) => document && document.status !== 'PENDING_REVIEW'
  );

  const isHighRisk = caseData.riskLevel === 'HIGH';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (outcome === 'NEEDS_INFORMATION' && !rationale.trim()) {
      setError('A rationale is mandatory when requesting additional information');
      return;
    }

    const code = reasonCode.trim().toUpperCase();
    if (!code || !code.match(/^[A-Z][A-Z0-9_]{0,59}$/)) {
      setError('Reason code must be an uppercase identifier (e.g. CHECKS_COMPLETE)');
      return;
    }

    setIsLoading(true);
    try {
      const idempotencyKey = generateIdempotencyKey();
      const res = await api.post<DecisionResponse>(
        `/api/v1/kyc/cases/${caseData.id}/verification-results`,
        {
          outcome,
          reasonCode: code,
          rationale: rationale.trim() || undefined,
        },
        { idempotencyKey }
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
      title="Submit Verification Recommendation"
      description="Record an analyst decision. Final status transition will be enforced by backend validation."
      size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={outcome === 'APPROVE' ? 'success' : outcome === 'REJECT' ? 'danger' : 'primary'}
            size="sm"
            onClick={handleSubmit}
            isLoading={isLoading}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Submit Decision
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* High Risk Notice */}
      {isHighRisk && outcome !== 'NEEDS_INFORMATION' && (
        <Alert variant="warning" className="mb-4">
          <strong>High-Risk Case:</strong> This case is designated HIGH risk. Submitting an{' '}
          {outcome} decision will transition the case to{' '}
          <span className="font-semibold">PENDING_SUPERVISOR_APPROVAL</span>, requiring independent
          review by a Compliance Supervisor before finalization.
        </Alert>
      )}

      {/* Readiness Pre-flight Information */}
      <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-blue-600" />
          Backend Readiness Gate Check
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                allChecksPass ? 'bg-emerald-500' : allChecksDone ? 'bg-amber-500' : 'bg-rose-500'
              }`}
            />
            <span>
              Checks: {mandatoryCheckTypes.length === 0 ? 'None configured' : allChecksPass ? `All ${mandatoryCheckTypes.length} PASS` : allChecksDone ? 'Completed (some non-PASS)' : 'Incomplete'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                allRequiredDocsAccepted ? 'bg-emerald-500' : allRequiredDocsReviewed ? 'bg-amber-500' : 'bg-rose-500'
              }`}
            />
            <span>
              Required documents:{' '}
              {requiredDocumentTypes.length === 0
                ? 'None configured'
                : `${requiredDocumentTypes.filter((type: string) => documents.some((doc) => doc.documentType === type)).length}/${requiredDocumentTypes.length} submitted`}
              {allRequiredDocsAccepted ? ' and accepted' : allRequiredDocsReviewed ? ' (reviewed)' : ' (pending or missing)'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Decision Outcome"
          value={outcome}
          onChange={(e) => {
            const next = e.target.value as DecisionOutcome;
            setOutcome(next);
            if (next === 'APPROVE') setReasonCode('CHECKS_COMPLETE');
            if (next === 'REJECT') setReasonCode('FAILED_VERIFICATION');
            if (next === 'NEEDS_INFORMATION') setReasonCode('ADDITIONAL_INFO_REQUIRED');
          }}
          options={[
            { value: 'APPROVE', label: 'APPROVE — Endorse case verification' },
            { value: 'REJECT', label: 'REJECT — Decline case verification' },
            { value: 'NEEDS_INFORMATION', label: 'NEEDS_INFORMATION — Request more details from customer' },
          ]}
          disabled={isLoading}
        />

        <Input
          label="Reason Code (Uppercase Identifier)"
          required
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value.toUpperCase())}
          placeholder="e.g. CHECKS_COMPLETE"
          helperText="Alphanumeric identifier with underscores (e.g. CHECKS_COMPLETE, DOCUMENT_DISCREPANCY)"
          disabled={isLoading}
        />

        <Textarea
          label={`Decision Rationale ${outcome === 'NEEDS_INFORMATION' ? '(Required)' : '(Optional)'}`}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder={
            outcome === 'NEEDS_INFORMATION'
              ? 'Specify what information or documents the customer must provide...'
              : 'Add any relevant audit observations or verification notes...'
          }
          maxLength={1000}
          rows={3}
          required={outcome === 'NEEDS_INFORMATION'}
          disabled={isLoading}
          helperText="Audit rationale preserved immutably in verification records (max 1000 chars)."
        />
      </form>
    </Modal>
  );
}
