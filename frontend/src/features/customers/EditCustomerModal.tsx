import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { CustomerResponse } from '@/types/customer';
import { extractErrorMessage } from '@/lib/api/errors';

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerResponse | null;
  onSuccess: (updated: CustomerResponse) => void;
}

export function EditCustomerModal({
  isOpen,
  onClose,
  customer,
  onSuccess,
}: EditCustomerModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setDisplayName(customer.displayName || '');
      setEmail(customer.email || '');
      setError(null);
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setError(null);

    setIsLoading(true);
    try {
      const res = await api.patch<CustomerResponse>(`/api/v1/customers/${customer.id}`, {
        displayName: displayName.trim(),
        email: email.trim(),
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
      title="Edit Customer Profile"
      description="Update contact information for this customer profile."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isLoading}>
            Save Changes
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
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          disabled={isLoading}
        />
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </form>
    </Modal>
  );
}
