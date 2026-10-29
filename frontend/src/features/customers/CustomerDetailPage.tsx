import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RiskBadge, PriorityBadge } from '@/components/shared/RiskBadge';
import { EditCustomerModal } from './EditCustomerModal';
import { CreateCaseModal } from '@/features/cases/CreateCaseModal';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { api } from '@/lib/api/client';
import { extractErrorMessage } from '@/lib/api/errors';
import { CustomerResponse } from '@/types/customer';
import { CaseResponse } from '@/types/case';
import { PageResponse } from '@/types/common';
import { formatDate } from '@/lib/utils';
import {
  User,
  FolderKanban,
  Plus,
  Edit2,
  ArrowLeft,
  Mail,
  Calendar,
  ExternalLink,
} from 'lucide-react';

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();

  const [customer, setCustomer] = useState<CustomerResponse | null>(null);
  const [casesPage, setCasesPage] = useState<PageResponse<CaseResponse> | null>(null);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);

  const loadCustomerAndCases = useCallback(async () => {
    if (!customerId) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch customer
      const cust = await api.get<CustomerResponse>(`/api/v1/customers/${customerId}`);
      setCustomer(cust);

      // 2. Fetch customer cases
      const cases = await api.get<PageResponse<CaseResponse>>(
        `/api/v1/customers/${customerId}/cases`,
        { params: { page, size: 20 } }
      );
      setCasesPage(cases);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [customerId, page]);

  useEffect(() => {
    loadCustomerAndCases();
  }, [loadCustomerAndCases]);

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size="lg" label="Loading customer profile..." />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <Link to="/customers" className="inline-flex items-center text-xs text-blue-600 hover:underline gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Customers
        </Link>
        <Alert variant="error" title="Customer Error">
          {error || 'Customer profile not found'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/customers"
            className="inline-flex items-center text-xs text-blue-600 hover:underline gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Customer Directory
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            {customer.displayName}
          </h1>
          <p className="text-xs text-slate-500 font-mono">ID: {customer.id}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
          >
            Edit Profile
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateCaseOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Create KYC Case
          </Button>
        </div>
      </div>

      {/* Customer Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Profile Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Full Name</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{customer.displayName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Email Address</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{customer.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Registered Date</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{formatDate(customer.createdAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Associated KYC Cases Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-blue-600" />
            Associated KYC Cases ({casesPage?.totalElements ?? 0})
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCreateCaseOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            New Case
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {!casesPage || casesPage.content.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<FolderKanban className="w-8 h-8" />}
                title="No KYC cases for this customer"
                description="Initiate a verification process by creating the first KYC case."
                actionLabel="Create KYC Case"
                onAction={() => setIsCreateCaseOpen(true)}
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
                    <Th>Created Date</Th>
                    <Th className="text-right">Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {casesPage.content.map((kycCase) => (
                    <Tr key={kycCase.id}>
                      <Td className="font-mono text-xs font-semibold">
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
                      <Td className="text-xs text-slate-500">{formatDate(kycCase.createdAt)}</Td>
                      <Td className="text-right">
                        <Button variant="outline" size="sm">
                          <Link to={`/cases/${kycCase.id}`}>Open Workspace</Link>
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              <Pagination
                page={casesPage.page}
                totalPages={casesPage.totalPages}
                totalElements={casesPage.totalElements}
                onPageChange={(p) => setPage(p)}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Customer Modal */}
      <EditCustomerModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        customer={customer}
        onSuccess={() => loadCustomerAndCases()}
      />

      {/* Create Case Modal */}
      <CreateCaseModal
        isOpen={isCreateCaseOpen}
        onClose={() => setIsCreateCaseOpen(false)}
        defaultCustomerId={customer.id}
        onSuccess={() => loadCustomerAndCases()}
      />
    </div>
  );
}
