import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { CustomerResponse } from '@/types/customer';
import { extractErrorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthContext';

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: CustomerResponse) => void;
}

export function CreateCustomerModal({ isOpen, onClose, onSuccess }: CreateCustomerModalProps) {
  const { isCustomer, user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setIsLoading(true);
    try {
      const payload = isCustomer
        ? { displayName: user?.displayName || 'Customer', email: user?.email || '' }
        : { displayName: displayName.trim(), email: email.trim() };

      const res = await api.post<CustomerResponse>('/api/v1/customers', payload);
      onSuccess(res);
      onClose();
      setDisplayName('');
      setEmail('');
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
      title={isCustomer ? 'Complete Your Customer Profile' : 'Register New Customer'}
      description={
        isCustomer
          ? 'Link your authenticated user account to a verified customer record.'
          : 'Create a new customer profile for KYC onboarding and case creation.'
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isLoading}>
            {isCustomer ? 'Create Profile' : 'Register Customer'}
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {isCustomer ? (
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
          <p>
            Your customer profile will be linked directly to your authenticated user identity:
          </p>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
            <p>
              <strong className="text-slate-800 dark:text-slate-200">Name:</strong> {user?.displayName}
            </p>
            <p>
              <strong className="text-slate-800 dark:text-slate-200">Email:</strong> {user?.email}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Full Name / Display Name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Jane Doe"
            disabled={isLoading}
          />
          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. jane.doe@example.test"
            disabled={isLoading}
          />
        </form>
      )}
    </Modal>
  );
}
