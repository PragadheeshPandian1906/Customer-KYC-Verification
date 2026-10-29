import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { CaseResponse, RiskLevel, Priority } from '@/types/case';
import { extractErrorMessage } from '@/lib/api/errors';

interface EditCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  kycCase: CaseResponse | null;
  onSuccess: (updated: CaseResponse) => void;
}

export function EditCaseModal({
  isOpen,
  onClose,
  kycCase,
  onSuccess,
}: EditCaseModalProps) {
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('LOW');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kycCase) {
      setRiskLevel(kycCase.riskLevel);
      setPriority(kycCase.priority);
      setError(null);
    }
  }, [kycCase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycCase) return;
    setError(null);

    setIsLoading(true);
    try {
      const res = await api.patch<CaseResponse>(`/api/v1/kyc/cases/${kycCase.id}`, {
        riskLevel,
        priority,
      });
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
      title="Adjust Case Risk & Priority"
      description="Update compliance parameters before a decision is submitted."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isLoading}>
            Update Parameters
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
        <Select
          label="Risk Level"
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}
          options={[
            { value: 'LOW', label: 'Low Risk' },
            { value: 'MEDIUM', label: 'Medium Risk' },
            { value: 'HIGH', label: 'High Risk (Requires Supervisor Approval)' },
          ]}
          disabled={isLoading}
        />

        <Select
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          options={[
            { value: 'LOW', label: 'Low' },
            { value: 'NORMAL', label: 'Normal' },
            { value: 'HIGH', label: 'High Priority' },
          ]}
          disabled={isLoading}
        />
      </form>
    </Modal>
  );
}
