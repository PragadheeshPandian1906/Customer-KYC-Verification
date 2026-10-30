import React, { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { AnalystSummary, AssignmentResponse } from '@/types/case';
import { PageResponse } from '@/types/common';
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
  const [analysts, setAnalysts] = useState<AnalystSummary[]>([]);
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    if (currentAnalystId) {
      setAnalystUserId(currentAnalystId);
    }
  }, [currentAnalystId]);

  const loadAnalysts = useCallback(async (requestedPage: number, query: string, append: boolean) => {
    setIsDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const result = await api.get<PageResponse<AnalystSummary>>('/api/v1/supervisor/analysts', {
        params: { page: requestedPage, size: 50, search: query || undefined },
      });
      setAnalysts((previous) => append ? [...previous, ...result.content] : result.content);
      setPage(result.page);
      setTotalPages(result.totalPages);
    } catch (err) {
      setDirectoryError(extractErrorMessage(err));
    } finally {
      setIsDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setAnalysts([]);
      setPage(0);
      void loadAnalysts(0, search, false);
    }
  }, [isOpen, loadAnalysts, search]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analystUserId.trim()) {
      setError('Select an active analyst from the directory');
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
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={isDirectoryLoading || Boolean(directoryError) || !analysts.some((analyst) => analyst.id === analystUserId)}
          >
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

      <form onSubmit={handleSearch} className="flex items-end gap-2 mb-3">
        <Input
          label="Find analyst"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Search by display name"
          disabled={isDirectoryLoading}
        />
        <Button type="submit" variant="outline" size="sm" disabled={isDirectoryLoading}>Search</Button>
      </form>

      {directoryError && (
        <Alert variant="error" className="mb-3">
          <div className="flex items-center justify-between gap-3">
            <span>Unable to load analysts: {directoryError}</span>
            <Button size="sm" variant="outline" onClick={() => void loadAnalysts(0, search, false)}>Retry</Button>
          </div>
        </Alert>
      )}

      <label htmlFor="assigned-analyst" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
        Active KYC analyst
      </label>
      <select
        id="assigned-analyst"
        value={analystUserId}
        onChange={(event) => setAnalystUserId(event.target.value)}
        disabled={isDirectoryLoading || isLoading}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
      >
        <option value="">{isDirectoryLoading ? 'Loading analysts...' : 'Select an analyst'}</option>
        {analysts.map((analyst) => (
          <option key={analyst.id} value={analyst.id}>{analyst.displayName}</option>
        ))}
      </select>
      {analysts.length === 0 && !isDirectoryLoading && !directoryError && (
        <p className="mt-2 text-xs text-slate-500">No active analysts match this search.</p>
      )}
      {page + 1 < totalPages && (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={isDirectoryLoading}
            onClick={() => void loadAnalysts(page + 1, search, true)}
          >
            Load more analysts
          </Button>
        </div>
      )}
    </Modal>
  );
}
