import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { AssignmentResponse } from '@/types/case';
import { extractErrorMessage } from '@/lib/api/errors';

interface AssignCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  currentAnalystId?: string | null;
  onSuccess: (assignments: AssignmentResponse[]) => void;
}

export function AssignCaseModal({
  isOpen,
  onClose,
  caseId,
  currentAnalystId,
  onSuccess,
}: AssignCaseModalProps) {
  const [analystUserId, setAnalystUserId] = useState(currentAnalystId || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (currentAnalystId) {
      setAnalystUserId(currentAnalystId);
    }
  }, [currentAnalystId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analystUserId.trim()) {
      setError('Please provide an eligible Analyst User ID');
      return;
    }
    setError(null);

    setIsLoading(true);
    try {
      const res = await api.post<AssignmentResponse[]>(
        `/api/v1/kyc/cases/${caseId}/assignments`,
        { analystUserId: analystUserId.trim() }
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
      title="Assign KYC Analyst"
      description="Designate an active KYC Analyst responsible for reviewing this case."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isLoading}>
            Confirm Assignment
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Analyst User ID (UUID)"
          required
          value={analystUserId}
          onChange={(e) => setAnalystUserId(e.target.value)}
          placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
          helperText="Enter the UUID of an active analyst account with KYC_ANALYST role."
          disabled={isLoading}
        />
      </form>
    </Modal>
  );
}
