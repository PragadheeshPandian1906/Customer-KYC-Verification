import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RiskBadge, PriorityBadge } from '@/components/shared/RiskBadge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { CaseResponse } from '@/types/case';
import { PageResponse } from '@/types/common';
import { formatDate } from '@/lib/utils';
import {
  FolderKanban,
  FileSearch,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export function AnalystDashboard() {
  const [cases, setCases] = useState<CaseResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<PageResponse<CaseResponse>>('/api/v1/kyc/cases', {
        params: { size: 100 },
      });
      setCases(response.content);
    } catch (err) {
      setError('Unable to load analyst review queue');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size="lg" label="Loading analyst workspace..." />
      </div>
    );
  }

  // Real data metrics
  const totalAssigned = cases.length;
  const inReviewCount = cases.filter((c) => c.status === 'IN_REVIEW').length;
  const needsInfoCount = cases.filter((c) => c.status === 'NEEDS_INFORMATION').length;
  const highRiskCount = cases.filter((c) => c.riskLevel === 'HIGH').length;

  const priorityQueue = cases.filter(
    (c) => c.status === 'IN_REVIEW' || c.status === 'DRAFT' || c.status === 'NEEDS_INFORMATION'
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-blue-600" />
            KYC Analyst Workspace
          </h1>
          <p className="text-xs text-slate-500">
            Review cases assigned to your analyst queue, perform verification checks, and submit recommendations.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadCases}>
          Refresh Queue
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Total Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalAssigned}</p>
            <p className="text-[11px] text-slate-500 mt-1">Cases in your workload</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Active Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{inReviewCount}</p>
            <p className="text-[11px] text-slate-500 mt-1">Ready for check submission</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Needs Info</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{needsInfoCount}</p>
            <p className="text-[11px] text-slate-500 mt-1">Awaiting customer response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">High Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{highRiskCount}</p>
            <p className="text-[11px] text-slate-500 mt-1">Requires supervisor sign-off</p>
          </CardContent>
        </Card>
      </div>

      {/* Priority Action Queue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-blue-600" />
            Active Review Queue ({priorityQueue.length})
          </CardTitle>
          <Link to="/cases" className="text-xs text-blue-600 hover:underline">
            View All ({cases.length})
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {priorityQueue.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p>Your active review queue is clear! No pending reviews awaiting checks.</p>
            </div>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Case Reference</Th>
                  <Th>Status</Th>
                  <Th>Risk</Th>
                  <Th>Priority</Th>
                  <Th>Created Date</Th>
                  <Th className="text-right">Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {priorityQueue.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-mono text-xs font-semibold">
                      <Link to={`/cases/${c.id}`} className="text-blue-600 hover:underline flex items-center gap-1">
                        {c.caseReference}
                        <ExternalLink className="w-3 h-3 inline" />
                      </Link>
                    </Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                    <Td>
                      <RiskBadge risk={c.riskLevel} />
                    </Td>
                    <Td>
                      <PriorityBadge priority={c.priority} />
                    </Td>
                    <Td className="text-xs text-slate-500">{formatDate(c.createdAt)}</Td>
                    <Td className="text-right">
                      <Button variant="outline" size="sm">
                        <Link to={`/cases/${c.id}`}>Open Workspace</Link>
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
