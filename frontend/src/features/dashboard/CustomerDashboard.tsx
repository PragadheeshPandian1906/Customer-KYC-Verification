import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CreateCaseModal } from '@/features/cases/CreateCaseModal';
import { CreateCustomerModal } from '@/features/customers/CreateCustomerModal';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { CaseResponse } from '@/types/case';
import { CustomerResponse } from '@/types/customer';
import { PageResponse } from '@/types/common';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  FolderKanban,
  FileText,
  Plus,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';

export function CustomerDashboard() {
  const { user } = useAuth();
  const [customer, setCustomer] = useState<CustomerResponse | null>(null);
  const [cases, setCases] = useState<CaseResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [isCreateProfileOpen, setIsCreateProfileOpen] = useState(false);

  const loadCustomerData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch own customer profile
      const custList = await api.get<PageResponse<CustomerResponse>>('/api/v1/customers');
      if (custList.content.length > 0) {
        setCustomer(custList.content[0]);
      } else {
        setCustomer(null);
      }

      // 2. Fetch own cases
      const caseList = await api.get<PageResponse<CaseResponse>>('/api/v1/kyc/cases');
      setCases(caseList.content);
    } catch (err) {
      setError('Unable to load customer information. Ensure you are signed in.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomerData();
  }, []);

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size="lg" label="Loading customer verification portal..." />
      </div>
    );
  }

  // Active / latest case
  const activeCase = cases.length > 0 ? cases[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome, {user?.displayName}
          </h1>
          <p className="text-xs text-slate-500">
            Manage your customer verification status, identity documents, and active KYC compliance requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!customer && (
            <Button
              size="sm"
              onClick={() => setIsCreateProfileOpen(true)}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              Complete Customer Profile
            </Button>
          )}

          {customer && (
            <Button
              size="sm"
              onClick={() => setIsCreateCaseOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New Verification Case
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Onboarding Notice if customer record not yet initialized */}
      {!customer && (
        <Alert variant="warning" title="Customer Profile Required">
          Your login identity is authenticated, but you do not yet have a linked Customer record in the system. Click "Complete Customer Profile" above to initialize your customer record.
        </Alert>
      )}

      {/* Needs Information Alert if active case requires input */}
      {activeCase?.status === 'NEEDS_INFORMATION' && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Additional Information Required</h4>
            <p className="text-xs">
              The KYC compliance analyst has requested additional clarification or replacement documents for case{' '}
              <span className="font-mono font-bold">{activeCase.caseReference}</span>.
            </p>
            <div className="pt-2">
              <Link to={`/cases/${activeCase.id}`}>
                <Button size="sm" variant="primary">
                  Provide Required Information
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Current KYC Status</CardTitle>
          </CardHeader>
          <CardContent>
            {activeCase ? (
              <div className="flex items-center gap-2">
                <StatusBadge status={activeCase.status} />
              </div>
            ) : (
              <p className="text-xs text-slate-400">No active KYC case</p>
            )}
            <p className="text-[11px] text-slate-500 mt-2">
              {activeCase?.status === 'APPROVED'
                ? 'Your identity is fully verified.'
                : activeCase?.status === 'IN_REVIEW'
                ? 'Your submitted evidence is under review by a compliance analyst.'
                : activeCase?.status === 'DRAFT'
                ? 'Please upload mandatory documents to submit.'
                : 'Status updated automatically from backend.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Active Case Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold font-mono text-slate-900 dark:text-slate-100">
              {activeCase?.caseReference || 'None'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Type: {activeCase?.caseType || '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase font-mono text-slate-400">Registered Customer ID</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate" title={customer?.id || ''}>
              {customer?.id || 'Not Registered'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {customer ? `${customer.displayName} (${customer.email})` : 'Awaiting profile initialization'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cases Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-blue-600" />
            My KYC Verification History ({cases.length})
          </CardTitle>
          {customer && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCreateCaseOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              New Case
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {cases.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-3">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p>You have no verification cases yet.</p>
              {customer && (
                <Button size="sm" onClick={() => setIsCreateCaseOpen(true)}>
                  Create Your First KYC Case
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Case Reference</Th>
                  <Th>Status</Th>
                  <Th>Case Type</Th>
                  <Th>Created Date</Th>
                  <Th className="text-right">Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {cases.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-mono text-xs font-semibold">
                      <Link to={`/cases/${c.id}`} className="text-blue-600 hover:underline">
                        {c.caseReference}
                      </Link>
                    </Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                    <Td className="text-xs">{c.caseType}</Td>
                    <Td className="text-xs text-slate-500">{formatDate(c.createdAt)}</Td>
                    <Td className="text-right">
                      <Button variant="outline" size="sm">
                        <Link to={`/cases/${c.id}`}>Manage Case</Link>
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Case Modal */}
      {customer && (
        <CreateCaseModal
          isOpen={isCreateCaseOpen}
          onClose={() => setIsCreateCaseOpen(false)}
          defaultCustomerId={customer.id}
          onSuccess={() => loadCustomerData()}
        />
      )}

      {/* Create Customer Profile Modal */}
      <CreateCustomerModal
        isOpen={isCreateProfileOpen}
        onClose={() => setIsCreateProfileOpen(false)}
        onSuccess={() => loadCustomerData()}
      />
    </div>
  );
}
