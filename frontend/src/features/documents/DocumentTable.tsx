import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { DocumentStatusBadge } from '@/components/shared/DocumentStatusBadge';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentVersionsModal } from './DocumentVersionsModal';
import { DocumentReviewModal } from './DocumentReviewModal';
import { DocumentResponse } from '@/types/document';
import { CaseResponse } from '@/types/case';
import { formatDate, formatBytes } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import { api } from '@/lib/api/client';
import { extractErrorMessage } from '@/lib/api/errors';
import { Download, History, CheckSquare, Plus, FileText } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';

interface DocumentTableProps {
  caseData: CaseResponse;
  documents: DocumentResponse[];
  onDocumentsChange: () => void;
}

export function DocumentTable({
  caseData,
  documents,
  onDocumentsChange,
}: DocumentTableProps) {
  const { isCustomer, isAnalyst, isSupervisor } = useAuth();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocForVersions, setSelectedDocForVersions] = useState<DocumentResponse | null>(null);
  const [selectedDocForReview, setSelectedDocForReview] = useState<DocumentResponse | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const isCaseTerminal = ['APPROVED', 'REJECTED', 'CLOSED'].includes(caseData.status);
  const canUpload = !isCaseTerminal;
  const canReview =
    (isAnalyst || isSupervisor) &&
    (caseData.status === 'IN_REVIEW' ||
      (caseData.status === 'PENDING_SUPERVISOR_APPROVAL' && isSupervisor));

  const handleDownloadLatest = async (doc: DocumentResponse) => {
    setDownloadingDocId(doc.id);
    setDownloadError(null);
    try {
      const { blob, filename } = await api.download(
        `/api/v1/kyc/cases/${caseData.id}/documents/${doc.id}/download`
      );
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename || `${doc.documentType}.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setDownloadError(extractErrorMessage(err));
    } finally {
      setDownloadingDocId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Case Documents & Proofs
          </h3>
          <p className="text-xs text-slate-500">
            Encrypted compliance files stored securely outside repository and web root.
          </p>
        </div>

        {canUpload && (
          <Button
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Upload Document
          </Button>
        )}
      </div>

      {downloadError && (
        <Alert variant="error" className="mb-2">
          {downloadError}
        </Alert>
      )}

      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No documents uploaded yet"
          description={
            isCustomer
              ? 'Please upload the mandatory IDENTITY_EVIDENCE document to begin the review process.'
              : 'The customer has not yet uploaded any documentation for this case.'
          }
          actionLabel={canUpload ? 'Upload First Document' : undefined}
          onAction={canUpload ? () => setIsUploadOpen(true) : undefined}
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Document Type</Th>
              <Th>Status</Th>
              <Th>Version</Th>
              <Th>File Name & Size</Th>
              <Th>Created Date</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {documents.map((doc) => (
              <Tr key={doc.id}>
                <Td className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                  {doc.documentType}
                </Td>
                <Td>
                  <DocumentStatusBadge status={doc.status} />
                </Td>
                <Td>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                    v{doc.currentVersion}
                  </span>
                </Td>
                <Td>
                  <div className="text-xs">
                    <p className="font-mono text-slate-800 dark:text-slate-200 truncate max-w-[180px]" title={doc.filename}>
                      {doc.filename}
                    </p>
                    <p className="text-[11px] text-slate-400">{formatBytes(doc.size)}</p>
                  </div>
                </Td>
                <Td className="text-xs text-slate-500">{formatDate(doc.createdAt)}</Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadLatest(doc)}
                      isLoading={downloadingDocId === doc.id}
                      title="Download latest version"
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                    >
                      <span className="hidden sm:inline">Download</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDocForVersions(doc)}
                      title="View version history"
                      leftIcon={<History className="w-3.5 h-3.5" />}
                    >
                      <span className="hidden sm:inline">Versions</span>
                    </Button>

                    {canReview && doc.status === 'PENDING_REVIEW' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setSelectedDocForReview(doc)}
                        title="Review document status"
                        leftIcon={<CheckSquare className="w-3.5 h-3.5" />}
                      >
                        Review
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        caseId={caseData.id}
        onSuccess={() => {
          onDocumentsChange();
        }}
      />

      {/* Versions Modal */}
      <DocumentVersionsModal
        isOpen={!!selectedDocForVersions}
        onClose={() => setSelectedDocForVersions(null)}
        caseId={caseData.id}
        document={selectedDocForVersions}
        canUploadNewVersion={canUpload}
        onVersionUploaded={() => {
          onDocumentsChange();
        }}
      />

      {/* Review Modal */}
      <DocumentReviewModal
        isOpen={!!selectedDocForReview}
        onClose={() => setSelectedDocForReview(null)}
        caseId={caseData.id}
        document={selectedDocForReview}
        onSuccess={() => {
          onDocumentsChange();
        }}
      />
    </div>
  );
}
