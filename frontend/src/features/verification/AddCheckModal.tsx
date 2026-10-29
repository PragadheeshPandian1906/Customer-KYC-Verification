import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { CheckResponse, CheckResult } from '@/types/verification';
import { DocumentResponse } from '@/types/document';
import { extractErrorMessage } from '@/lib/api/errors';
import { CheckSquare } from 'lucide-react';

interface AddCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  documents: DocumentResponse[];
  onSuccess: (newCheck: CheckResponse) => void;
}

export function AddCheckModal({
  isOpen,
  onClose,
  caseId,
  documents,
  onSuccess,
}: AddCheckModalProps) {
  const checkTypes = (import.meta.env.VITE_KYC_VERIFICATION_CHECK_TYPES ||
    'CUSTOMER_INFORMATION,IDENTITY_DOCUMENT,ADDRESS_DOCUMENT')
    .split(',')
    .map((type: string) => type.trim())
    .filter(Boolean);
  const [checkType, setCheckType] = useState(checkTypes[0] || '');
  const [result, setResult] = useState<CheckResult>('PASS');
  const [notes, setNotes] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setIsLoading(true);
    try {
      const payload: {
        checkType: string;
        result: CheckResult;
        notes?: string;
        documentId?: string;
      } = {
        checkType,
        result,
      };

      if (notes.trim()) {
        payload.notes = notes.trim();
      }
      if (documentId.trim()) {
        payload.documentId = documentId.trim();
      }

      const res = await api.post<CheckResponse>(
        `/api/v1/kyc/cases/${caseId}/verification-checks`,
        payload
      );
      onSuccess(res);
      onClose();
      setNotes('');
      setDocumentId('');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const docOptions = [
    { value: '', label: 'None (General / Direct Verification)' },
    ...documents.map((d) => ({
      value: d.id,
      label: `${d.documentType} (${d.filename})`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Verification Check"
      description="Perform and record an audited verification check against customer information or documents."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isLoading}
            leftIcon={<CheckSquare className="w-4 h-4" />}
          >
            Submit Check
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Verification Check Type"
          value={checkType}
          onChange={(e) => setCheckType(e.target.value)}
          options={checkTypes.map((type) => ({ value: type, label: type }))}
          disabled={isLoading}
        />

        <Select
          label="Check Result"
          value={result}
          onChange={(e) => setResult(e.target.value as CheckResult)}
          options={[
            { value: 'PASS', label: 'PASS (Verified and Valid)' },
            { value: 'FAIL', label: 'FAIL (Verification Failed / Discrepancy)' },
            { value: 'NEEDS_INFORMATION', label: 'NEEDS_INFORMATION (Incomplete / Unclear)' },
            { value: 'NOT_APPLICABLE', label: 'NOT_APPLICABLE' },
          ]}
          disabled={isLoading}
        />

        <Select
          label="Associated Document (Optional)"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          options={docOptions}
          disabled={isLoading}
          helperText="Link check to a specific uploaded evidence item."
        />

        <Textarea
          label="Verification Notes (Max 500 characters)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Synthetic test evidence matched official records."
          maxLength={500}
          rows={3}
          disabled={isLoading}
        />
      </form>
    </Modal>
  );
}
