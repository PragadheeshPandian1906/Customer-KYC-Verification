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
import { extractErrorMessage } from '@/lib/api/errors';
import { formatDate } from '@/lib/utils';
import {
  ShieldCheck,
  CheckSquare2,
  UserCheck,
  ExternalLink,
} from 'lucide-react';

export function SupervisorDashboard() {
  const [cases, setCases] = useState<CaseResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCases(await api.getAllPages<CaseResponse>('/api/v1/kyc/cases'));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size="lg" label="Loading compliance supervisor dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Compliance Supervisor Oversight</h1>
        <Alert variant="error" title="Unable to load supervisor oversight data">
          {error}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={loadData}>Retry</Button>
          </div>
        </Alert>
      </div>
    );
  }

  // Real data metrics
  const totalCases = cases.length;
  const pendingApprovals = cases.filter((c) => c.status === 'PENDING_SUPERVISOR_APPROVAL');
  const unassignedCases = cases.filter(
    (c) =>
      !c.assignedToUserId &&
      c.status !== 'APPROVED' &&
      c.status !== 'REJECTED' &&
      c.status !== 'CLOSED'
  );
  const highRiskCount = cases.filter((c) => c.riskLevel === 'HIGH').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            Compliance Supervisor Oversight
          </h1>
          <p className="text-xs text-slate-500">
            Institution-wide case oversight, analyst delegation, high-risk approvals, and case closures.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
          Refresh Oversight
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Total System Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalCases}</p>
            <p className="text-[11px] text-slate-500 mt-1">Across all customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {pendingApprovals.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">High-risk recommendations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Unassigned Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {unassignedCases.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Requiring analyst assignment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">High Risk Registry</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{highRiskCount}</p>
            <p className="text-[11px] text-slate-500 mt-1">Designated HIGH risk</p>
          </CardContent>
        </Card>
      </div>

      {/* High-Risk Pending Approvals Banner/Table */}
      {pendingApprovals.length > 0 && (
        <Card className="border-purple-200 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/20">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-900 dark:text-purple-200">
              <CheckSquare2 className="w-4 h-4 text-purple-600" />
              High-Risk Approvals Requiring Sign-off ({pendingApprovals.length})
            </CardTitle>
            <Link to="/approvals">
              <Button size="sm" variant="primary">
                Open Approval Queue
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <Tr>
                  <Th>Case Reference</Th>
                  <Th>Risk</Th>
                  <Th>Status</Th>
                  <Th>Assigned Analyst</Th>
                  <Th>Last Updated</Th>
                  <Th className="text-right">Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pendingApprovals.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-mono text-xs font-semibold">
                      <Link to={`/cases/${c.id}`} className="text-blue-600 hover:underline flex items-center gap-1">
                        {c.caseReference}
                        <ExternalLink className="w-3 h-3 inline" />
                      </Link>
                    </Td>
                    <Td>
                      <RiskBadge risk={c.riskLevel} />
                    </Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                    <Td className="font-mono text-xs text-slate-500">
                      {c.assignedToUserId || 'Unassigned'}
                    </Td>
                    <Td className="text-xs text-slate-500">{formatDate(c.updatedAt)}</Td>
                    <Td className="text-right">
                      <Button variant="outline" size="sm">
                        <Link to={`/cases/${c.id}`}>Review Case</Link>
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Unassigned Cases Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-600" />
            Unassigned Cases ({unassignedCases.length})
          </CardTitle>
          <Link to="/cases" className="text-xs text-blue-600 hover:underline">
            View All ({cases.length})
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {unassignedCases.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p>All active cases are assigned to an active KYC Analyst.</p>
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
                {unassignedCases.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-mono text-xs font-semibold">
                      <Link to={`/cases/${c.id}`} className="text-blue-600 hover:underline">
                        {c.caseReference}
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
                        <Link to={`/cases/${c.id}`}>Assign Analyst</Link>
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
