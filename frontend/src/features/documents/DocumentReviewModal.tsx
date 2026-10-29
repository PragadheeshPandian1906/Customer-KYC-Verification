import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { DocumentResponse, DocumentStatus } from '@/types/document';
import { extractErrorMessage } from '@/lib/api/errors';
import { CheckCircle2, XCircle } from 'lucide-react';

interface DocumentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  document: DocumentResponse | null;
  onSuccess: (updated: DocumentResponse) => void;
}

export function DocumentReviewModal({
  isOpen,
  onClose,
  caseId,
  document,
  onSuccess,
}: DocumentReviewModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!document) return null;

  const handleUpdateStatus = async (status: DocumentStatus) => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await api.patch<DocumentResponse>(
        `/api/v1/kyc/cases/${caseId}/documents/${document.id}/status`,
        { status }
      );
      onSuccess(updated);
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
      title={`Review Document — ${document.documentType}`}
      description="Record an official compliance determination for this uploaded document."
      footer={
        <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
          <p>
            <strong className="text-slate-700 dark:text-slate-300">File:</strong> {document.filename}
          </p>
          <p>
            <strong className="text-slate-700 dark:text-slate-300">Version:</strong> v{document.currentVersion}
          </p>
          <p>
            <strong className="text-slate-700 dark:text-slate-300">Current Status:</strong> {document.status}
          </p>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Ensure you have downloaded and inspected the file contents for authenticity, legibility, and validity prior to acceptance.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="success"
            size="md"
            onClick={() => handleUpdateStatus('ACCEPTED')}
            isLoading={isLoading}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Accept Document
          </Button>

          <Button
            variant="danger"
            size="md"
            onClick={() => handleUpdateStatus('REJECTED')}
            isLoading={isLoading}
            leftIcon={<XCircle className="w-4 h-4" />}
          >
            Reject Document
          </Button>
        </div>
      </div>
    </Modal>
  );
}
