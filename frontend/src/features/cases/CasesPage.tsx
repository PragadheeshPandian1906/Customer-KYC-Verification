import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RiskBadge, PriorityBadge } from '@/components/shared/RiskBadge';
import { CreateCaseModal } from './CreateCaseModal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { extractErrorMessage } from '@/lib/api/errors';
import { CaseResponse } from '@/types/case';
import { PageResponse } from '@/types/common';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  FolderKanban,
  Plus,
  Search,
  ExternalLink,
} from 'lucide-react';

export function CasesPage() {
  const { isCustomer, isAnalyst } = useAuth();

  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [sortBy, setSortBy] = useState('createdAt');
  const [data, setData] = useState<PageResponse<CaseResponse> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client-side quick filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchCases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<PageResponse<CaseResponse>>('/api/v1/kyc/cases', {
        params: {
          page,
          size: pageSize,
          sortBy,
        },
      });
      setData(response);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortBy]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Client filtering on the fetched page
  const filteredCases = (data?.content || []).filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (riskFilter !== 'ALL' && item.riskLevel !== riskFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const refMatch = item.caseReference.toLowerCase().includes(term);
      const custMatch = item.customerId.toLowerCase().includes(term);
      const idMatch = item.id.toLowerCase().includes(term);
      if (!refMatch && !custMatch && !idMatch) return false;
    }
    return true;
  });

  const pageTitle = isCustomer
    ? 'My KYC Verification Cases'
    : isAnalyst
    ? 'Assigned KYC Review Queue'
    : 'All KYC Cases';

  const pageSubtitle = isCustomer
    ? 'View and monitor your customer identity verification processes.'
    : isAnalyst
    ? 'Cases currently assigned to your analyst identity for compliance review.'
    : 'Comprehensive compliance register of all KYC cases across the institution.';

  return (
    <div className="space-y-6">
      {/* Header & New Case Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-600" />
            {pageTitle}
          </h1>
          <p className="text-xs text-slate-500">{pageSubtitle}</p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New KYC Case
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <Input
                placeholder="Search by case reference or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'IN_REVIEW', label: 'In Review' },
                { value: 'PENDING_SUPERVISOR_APPROVAL', label: 'Pending Approval' },
                { value: 'NEEDS_INFORMATION', label: 'Needs Information' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'REJECTED', label: 'Rejected' },
                { value: 'CLOSED', label: 'Closed' },
              ]}
            />

            <Select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Risk Levels' },
                { value: 'LOW', label: 'Low Risk' },
                { value: 'MEDIUM', label: 'Medium Risk' },
                { value: 'HIGH', label: 'High Risk' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Case Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm">
            Case Register ({data?.totalElements ?? filteredCases.length})
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
            >
              <option value="createdAt">Created Date</option>
              <option value="updatedAt">Updated Date</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16">
              <Spinner size="md" label="Loading KYC cases..." />
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<FolderKanban className="w-8 h-8" />}
                title="No KYC cases found"
                description={
                  searchTerm || statusFilter !== 'ALL' || riskFilter !== 'ALL'
                    ? 'Try clearing your filters to see more results.'
                    : 'Get started by creating a new KYC verification case.'
                }
                actionLabel={
                  searchTerm || statusFilter !== 'ALL' || riskFilter !== 'ALL'
                    ? 'Reset Filters'
                    : 'Create New KYC Case'
                }
                onAction={
                  searchTerm || statusFilter !== 'ALL' || riskFilter !== 'ALL'
                    ? () => {
                        setSearchTerm('');
                        setStatusFilter('ALL');
                        setRiskFilter('ALL');
                      }
                    : () => setIsCreateOpen(true)
                }
              />
            </div>
          ) : (
            <>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Case Reference</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Risk Level</Th>
                    <Th>Priority</Th>
                    {!isCustomer && <Th>Assigned Analyst</Th>}
                    <Th>Created Date</Th>
                    <Th className="text-right">Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredCases.map((kycCase) => (
                    <Tr key={kycCase.id}>
                      <Td className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                        <Link
                          to={`/cases/${kycCase.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          {kycCase.caseReference}
                          <ExternalLink className="w-3 h-3 inline" />
                        </Link>
                      </Td>
                      <Td className="text-xs">{kycCase.caseType}</Td>
                      <Td>
                        <StatusBadge status={kycCase.status} />
                      </Td>
                      <Td>
                        <RiskBadge risk={kycCase.riskLevel} />
                      </Td>
                      <Td>
                        <PriorityBadge priority={kycCase.priority} />
                      </Td>
                      {!isCustomer && (
                        <Td className="font-mono text-xs text-slate-500">
                          {kycCase.assignedToUserId ? (
                            <span title={kycCase.assignedToUserId}>
                              {kycCase.assignedToUserId.substring(0, 8)}...
                            </span>
                          ) : (
                            <span className="italic text-slate-400">Unassigned</span>
                          )}
                        </Td>
                      )}
                      <Td className="text-xs text-slate-500">{formatDate(kycCase.createdAt)}</Td>
                      <Td className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {}}
                        >
                          <Link to={`/cases/${kycCase.id}`}>View Workspace</Link>
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              {data && (
                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  totalElements={data.totalElements}
                  onPageChange={(p) => setPage(p)}
                  isLoading={isLoading}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Case Modal */}
      <CreateCaseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => fetchCases()}
      />
    </div>
  );
}
