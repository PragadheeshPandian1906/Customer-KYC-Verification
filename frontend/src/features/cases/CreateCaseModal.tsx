import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { CaseResponse, CaseType, RiskLevel, Priority } from '@/types/case';
import { extractErrorMessage } from '@/lib/api/errors';
import { generateIdempotencyKey } from '@/lib/utils';

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCustomerId?: string;
  onSuccess: (newCase: CaseResponse) => void;
}

export function CreateCaseModal({
  isOpen,
  onClose,
  defaultCustomerId = '',
  onSuccess,
}: CreateCaseModalProps) {
  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [caseType, setCaseType] = useState<CaseType>('INDIVIDUAL');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('LOW');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (defaultCustomerId) {
      setCustomerId(defaultCustomerId);
    }
  }, [defaultCustomerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId.trim()) {
      setError('Customer ID is required');
      return;
    }
    setError(null);

    setIsLoading(true);
    try {
      const idempotencyKey = generateIdempotencyKey();
      const res = await api.post<CaseResponse>(
        '/api/v1/kyc/cases',
        {
          customerId: customerId.trim(),
          caseType,
          riskLevel,
          priority,
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
      title="Create New KYC Case"
      description="Initiate a verification case for a customer record."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isLoading}>
            Create KYC Case
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
          label="Customer ID (UUID)"
          required
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
          disabled={isLoading || !!defaultCustomerId}
          helperText="The unique UUID identifier of the customer."
        />

        <Select
          label="Case Type"
          value={caseType}
          onChange={(e) => setCaseType(e.target.value as CaseType)}
          options={[
            { value: 'INDIVIDUAL', label: 'Individual (Standard Customer Verification)' },
            { value: 'BUSINESS', label: 'Business (Corporate / Entity Verification)' },
          ]}
          disabled={isLoading}
        />

        <Select
          label="Initial Risk Level"
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}
          options={[
            { value: 'LOW', label: 'Low Risk (Standard automation eligible)' },
            { value: 'MEDIUM', label: 'Medium Risk' },
            { value: 'HIGH', label: 'High Risk (Requires Supervisor Approval)' },
          ]}
          disabled={isLoading}
          helperText="High risk decisions require compliance supervisor sign-off."
        />

        <Select
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          options={[
            { value: 'LOW', label: 'Low' },
            { value: 'NORMAL', label: 'Normal' },
            { value: 'HIGH', label: 'High (Expedited compliance queue)' },
          ]}
          disabled={isLoading}
        />
      </form>
    </Modal>
  );
}
