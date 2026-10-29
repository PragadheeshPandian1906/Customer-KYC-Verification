import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { api } from '@/lib/api/client';
import { DocumentResponse, DocumentVersionResponse } from '@/types/document';
import { extractErrorMessage } from '@/lib/api/errors';
import { formatDate, formatBytes, generateIdempotencyKey } from '@/lib/utils';
import { Download, Upload, CheckCircle2, History } from 'lucide-react';

interface DocumentVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  document: DocumentResponse | null;
  canUploadNewVersion?: boolean;
  onVersionUploaded: (updatedDoc: DocumentResponse) => void;
}

export function DocumentVersionsModal({
  isOpen,
  onClose,
  caseId,
  document,
  canUploadNewVersion = true,
  onVersionUploaded,
}: DocumentVersionsModalProps) {
  const [versions, setVersions] = useState<DocumentVersionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingVersion, setDownloadingVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen && document) {
      loadVersions();
      setNewFile(null);
      setError(null);
    }
  }, [isOpen, document]);

  const loadVersions = async () => {
    if (!document) return;
    setIsLoading(true);
    try {
      const data = await api.get<DocumentVersionResponse[]>(
        `/api/v1/kyc/cases/${caseId}/documents/${document.id}/versions`
      );
      setVersions(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadVersion = async (versionNumber: number) => {
    if (!document) return;
    setDownloadingVersion(versionNumber);
    try {
      const { blob, filename } = await api.download(
        `/api/v1/kyc/cases/${caseId}/documents/${document.id}/versions/${versionNumber}/content`
      );
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename || `${document.documentType}-v${versionNumber}`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setDownloadingVersion(null);
    }
  };

  const handleUploadVersion = async () => {
    if (!document || !newFile) return;
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', newFile);

      const idempotencyKey = generateIdempotencyKey();
      const updated = await api.upload<DocumentResponse>(
        `/api/v1/kyc/cases/${caseId}/documents/${document.id}/versions`,
        formData,
        { idempotencyKey }
      );
      onVersionUploaded(updated);
      setNewFile(null);
      await loadVersions();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Version History — ${document?.documentType}`}
      description="View immutable audit versions and upload revisions if required."
      size="lg"
      footer={
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Spinner size="md" label="Loading version history..." />
      ) : (
        <div className="space-y-5">
          <Table>
            <Thead>
              <Tr>
                <Th>Version</Th>
                <Th>Filename</Th>
                <Th>File Size</Th>
                <Th>Uploaded Date</Th>
                <Th className="text-right">Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {versions.map((ver) => (
                <Tr key={ver.id}>
                  <Td>
                    <span className="font-mono font-semibold text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                      v{ver.version}
                    </span>
                  </Td>
                  <Td className="font-mono text-xs max-w-[200px] truncate" title={ver.filename}>
                    {ver.filename}
                  </Td>
                  <Td className="text-xs">{formatBytes(ver.size)}</Td>
                  <Td className="text-xs text-slate-500">{formatDate(ver.uploadedAt)}</Td>
                  <Td className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadVersion(ver.version)}
                      isLoading={downloadingVersion === ver.version}
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                    >
                      Download
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          {canUploadNewVersion && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Upload New Document Revision
              </h4>
              <p className="text-xs text-slate-500">
                Uploading a revision will increment the version number and reset document review status to <span className="font-semibold">PENDING_REVIEW</span>.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  id="version-file-input"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setNewFile(e.target.files[0]);
                    }
                  }}
                  disabled={isUploading}
                />
                <label
                  htmlFor="version-file-input"
                  className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>{newFile ? newFile.name : 'Select replacement file...'}</span>
                </label>
                {newFile && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleUploadVersion}
                    isLoading={isUploading}
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Confirm Upload
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
