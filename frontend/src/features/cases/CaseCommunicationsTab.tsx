import { FormEvent, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/lib/auth/AuthContext';
import { api } from '@/lib/api/client';
import { extractErrorMessage } from '@/lib/api/errors';
import { formatDate } from '@/lib/utils';
import { CaseResponse } from '@/types/case';
import { DocumentResponse } from '@/types/document';

export interface CaseCommunication {
  id: string;
  type: 'INFORMATION_REQUEST' | 'CUSTOMER_RESPONSE';
  senderRole: string;
  senderDisplayName: string;
  message: string;
  parentCommunicationId: string | null;
  sourceDecisionId: string | null;
  documents: { id: string; documentType: string }[];
  createdAt: string;
}

interface CaseCommunicationsTabProps {
  caseData: CaseResponse;
  documents: DocumentResponse[];
  communications: CaseCommunication[];
  onDataChange: () => void;
}

export function CaseCommunicationsTab({
  caseData,
  documents,
  communications,
  onDataChange,
}: CaseCommunicationsTabProps) {
  const { isCustomer } = useAuth();
  const [message, setMessage] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unansweredRequest = useMemo(() => {
    const respondedRequestIds = new Set(
      communications
        .filter((communication) => communication.type === 'CUSTOMER_RESPONSE')
        .map((communication) => communication.parentCommunicationId)
    );
    return [...communications].reverse().find((communication) =>
      communication.type === 'INFORMATION_REQUEST' && !respondedRequestIds.has(communication.id)
    );
  }, [communications]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!unansweredRequest || !message.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post<CaseCommunication>(
        `/api/v1/kyc/cases/${caseData.id}/communications/responses`,
        {
          requestId: unansweredRequest.id,
          message: message.trim(),
          documentIds: selectedDocumentIds,
        }
      );
      setMessage('');
      setSelectedDocumentIds([]);
      onDataChange();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDocument = (documentId: string) => {
    setSelectedDocumentIds((current) => current.includes(documentId)
      ? current.filter((id) => id !== documentId)
      : [...current, documentId]);
  };

  return (
    <div className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}

      {isCustomer && caseData.status === 'NEEDS_INFORMATION' && unansweredRequest && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Respond to information request</h3>
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{unansweredRequest.message}</p>
          </div>
          <Textarea
            label="Your response"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={2000}
            required
            disabled={isSubmitting}
            placeholder="Provide the requested information"
          />
          {documents.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Attach documents already uploaded to this case (optional)
              </legend>
              {documents.map((document) => (
                <label key={document.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedDocumentIds.includes(document.id)}
                    onChange={() => toggleDocument(document.id)}
                    disabled={isSubmitting || (
                      selectedDocumentIds.length >= 20 && !selectedDocumentIds.includes(document.id)
                    )}
                  />
                  <span>{document.documentType}: {document.filename}</span>
                </label>
              ))}
            </fieldset>
          )}
          <Button type="submit" size="sm" isLoading={isSubmitting} disabled={!message.trim()}>
            Send response
          </Button>
        </form>
      )}

      {communications.length === 0 ? (
        <p className="text-sm text-slate-500">There are no additional-information messages for this case.</p>
      ) : (
        <ol className="space-y-3">
          {communications.map((communication) => (
            <li key={communication.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {communication.type === 'INFORMATION_REQUEST' ? 'Information requested' : 'Customer response'}
                  {' · '}{communication.senderDisplayName}
                </span>
                <time className="text-[11px] text-slate-500">{formatDate(communication.createdAt)}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{communication.message}</p>
              {communication.documents.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Referenced documents: {communication.documents.map((document) => document.documentType).join(', ')}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {isCustomer && caseData.status === 'NEEDS_INFORMATION' && !unansweredRequest && (
        <Alert variant="info">
          The case is waiting for information, but no unanswered request is available. Contact your KYC team.
        </Alert>
      )}
    </div>
  );
}
