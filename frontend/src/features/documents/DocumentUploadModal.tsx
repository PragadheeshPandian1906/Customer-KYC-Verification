import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { DocumentResponse } from '@/types/document';
import { extractErrorMessage } from '@/lib/api/errors';
import { generateIdempotencyKey, formatBytes } from '@/lib/utils';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  onSuccess: (newDoc: DocumentResponse) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentUploadModal({
  isOpen,
  onClose,
  caseId,
  onSuccess,
}: DocumentUploadModalProps) {
  const [documentType, setDocumentType] = useState('IDENTITY_EVIDENCE');
  const [customType, setCustomType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > MAX_FILE_SIZE) {
        setError(`File size exceeds 10MB limit (selected: ${formatBytes(selected.size)})`);
        setFile(null);
        return;
      }
      const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowed.includes(selected.type)) {
        setError('Only PDF, JPEG, and PNG files are supported');
        setFile(null);
        return;
      }
      setFile(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    const typeToSubmit = documentType === 'OTHER' ? customType.toUpperCase().trim() : documentType;
    if (!typeToSubmit || !typeToSubmit.match(/^[A-Z][A-Z0-9_]{0,39}$/)) {
      setError('Document type must be an uppercase alphanumeric identifier (max 40 chars)');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('documentType', typeToSubmit);
      formData.append('file', file);

      const idempotencyKey = generateIdempotencyKey();
      const res = await api.upload<DocumentResponse>(
        `/api/v1/kyc/cases/${caseId}/documents`,
        formData,
        { idempotencyKey }
      );
      onSuccess(res);
      onClose();
      setFile(null);
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
      title="Upload Compliance Document"
      description="Upload an encrypted identity or address document for KYC verification."
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
            disabled={!file}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Upload Document
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
          label="Document Type"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          options={[
            { value: 'IDENTITY_EVIDENCE', label: 'IDENTITY_EVIDENCE (Mandatory for Approval)' },
            { value: 'ADDRESS_EVIDENCE', label: 'ADDRESS_EVIDENCE (Proof of Residence)' },
            { value: 'CORPORATE_REGISTRATION', label: 'CORPORATE_REGISTRATION (Articles of Inc.)' },
            { value: 'FINANCIAL_STATEMENT', label: 'FINANCIAL_STATEMENT' },
            { value: 'OTHER', label: 'OTHER (Custom Uppercase Identifier)' },
          ]}
          disabled={isLoading}
        />

        {documentType === 'OTHER' && (
          <Input
            label="Custom Document Type"
            required
            placeholder="e.g. TAX_CERTIFICATE"
            value={customType}
            onChange={(e) => setCustomType(e.target.value.toUpperCase())}
            helperText="Uppercase letters, numbers, and underscores only"
            disabled={isLoading}
          />
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Document File (PDF, JPEG, PNG - Max 10MB) <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 hover:border-blue-500 transition-colors bg-slate-50/50 dark:bg-slate-900/50">
            <input
              type="file"
              id="doc-file-input"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={handleFileChange}
              disabled={isLoading}
            />
            <label
              htmlFor="doc-file-input"
              className="cursor-pointer flex flex-col items-center text-center space-y-2 w-full"
            >
              {file ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                      Choose a file
                    </span>{' '}
                    <span className="text-xs text-slate-500">or drag and drop</span>
                  </div>
                  <p className="text-[11px] text-slate-400">PDF, JPEG, or PNG up to 10MB</p>
                </>
              )}
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
