import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { CreateCustomerModal } from './CreateCustomerModal';
import { EditCustomerModal } from './EditCustomerModal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api/client';
import { extractErrorMessage } from '@/lib/api/errors';
import { CustomerResponse } from '@/types/customer';
import { PageResponse } from '@/types/common';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import { Users, Plus, Search, Edit2, FolderKanban } from 'lucide-react';

export function CustomersPage() {
  const { isCustomer, isAnalyst } = useAuth();

  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [sortBy, setSortBy] = useState('createdAt');
  const [data, setData] = useState<PageResponse<CustomerResponse> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<CustomerResponse | null>(null);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<PageResponse<CustomerResponse>>('/api/v1/customers', {
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
    fetchCustomers();
  }, [fetchCustomers]);

  const filtered = (data?.content || []).filter((cust) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      cust.displayName.toLowerCase().includes(term) ||
      cust.email.toLowerCase().includes(term) ||
      cust.id.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            {isCustomer ? 'My Customer Identity' : 'Customer Directory'}
          </h1>
          <p className="text-xs text-slate-500">
            {isCustomer
              ? 'Your verified institutional customer profile.'
              : isAnalyst
              ? 'Customers with active cases assigned to your analyst review queue.'
              : 'Complete register of registered enterprise customer entities.'}
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Register Customer
        </Button>
      </div>

      {error && (
        <Alert variant="error" title="Unable to load customers">
          {error}
          <Button size="sm" variant="outline" className="mt-3" onClick={fetchCustomers}>Retry</Button>
        </Alert>
      )}

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search by customer name, email address, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Search applies only to the currently loaded page.
          </p>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm">
            Customers ({searchTerm.trim() ? `${filtered.length} shown on this page` : `${data?.totalElements ?? filtered.length} total`})
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
            >
              <option value="createdAt">Created Date</option>
              <option value="displayName">Name</option>
              <option value="email">Email</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16">
              <Spinner size="md" label="Loading customer directory..." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Users className="w-8 h-8" />}
                title="No customer records found"
                description={
                  searchTerm
                    ? 'No customers match the entered search query.'
                    : 'Register a new customer profile to initiate KYC onboarding.'
                }
                actionLabel={searchTerm ? 'Clear Search' : 'Register Customer'}
                onAction={searchTerm ? () => setSearchTerm('') : () => setIsCreateOpen(true)}
              />
            </div>
          ) : (
            <>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Display Name</Th>
                    <Th>Email Address</Th>
                    <Th>Customer ID</Th>
                    <Th>Registered Date</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filtered.map((cust) => (
                    <Tr key={cust.id}>
                      <Td className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        <Link
                          to={`/customers/${cust.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {cust.displayName}
                        </Link>
                      </Td>
                      <Td className="text-xs text-slate-600 dark:text-slate-300">{cust.email}</Td>
                      <Td className="font-mono text-xs text-slate-400">{cust.id}</Td>
                      <Td className="text-xs text-slate-500">{formatDate(cust.createdAt)}</Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedForEdit(cust)}
                            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                          >
                            Edit
                          </Button>
                          <Button variant="outline" size="sm">
                            <Link
                              to={`/customers/${cust.id}`}
                              className="inline-flex items-center gap-1"
                            >
                              <FolderKanban className="w-3.5 h-3.5" />
                              Cases
                            </Link>
                          </Button>
                        </div>
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

      {/* Create Modal */}
      <CreateCustomerModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => fetchCustomers()}
      />

      {/* Edit Modal */}
      <EditCustomerModal
        isOpen={!!selectedForEdit}
        onClose={() => setSelectedForEdit(null)}
        customer={selectedForEdit}
        onSuccess={() => fetchCustomers()}
      />
    </div>
  );
}
