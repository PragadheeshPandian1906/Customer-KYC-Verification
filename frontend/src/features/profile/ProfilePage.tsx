import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { EditCustomerModal } from '@/features/customers/EditCustomerModal';
import { CreateCustomerModal } from '@/features/customers/CreateCustomerModal';
import { useAuth } from '@/lib/auth/AuthContext';
import { api } from '@/lib/api/client';
import { CustomerResponse } from '@/types/customer';
import { PageResponse } from '@/types/common';
import { formatDate } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/api/errors';
import {
  User,
  ShieldCheck,
  KeyRound,
  Edit2,
  UserPlus,
  CheckCircle2,
} from 'lucide-react';

export function ProfilePage() {
  const { user, isCustomer } = useAuth();
  const [customer, setCustomer] = useState<CustomerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateProfileOpen, setIsCreateProfileOpen] = useState(false);

  const loadCustomer = async () => {
    if (!isCustomer) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<PageResponse<CustomerResponse>>('/api/v1/customers');
      if (res.content.length > 0) {
        setCustomer(res.content[0]);
      } else {
        setCustomer(null);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomer();
  }, [isCustomer]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" />
          My Profile & Session
        </h1>
        <p className="text-xs text-slate-500">
          User account identity, role credentials, and linked institutional customer profile.
        </p>
      </div>

      {/* User Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-600" />
            Authenticated User Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-400 text-[11px]">User Account ID</p>
              <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">{user?.id}</p>
            </div>

            <div>
              <p className="text-slate-400 text-[11px]">Display Name</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{user?.displayName}</p>
            </div>

            <div>
              <p className="text-slate-400 text-[11px]">Email Address</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{user?.email}</p>
            </div>

            <div>
              <p className="text-slate-400 text-[11px]">Granted Roles</p>
              <div className="flex gap-1.5 flex-wrap mt-0.5">
                {user?.roles?.map((r) => (
                  <Badge key={r} variant="blue" size="sm">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Profile (For CUSTOMER role) */}
      {isCustomer && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Linked Customer Profile
            </CardTitle>
            {isLoading || error ? null : customer ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(true)}
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              >
                Edit Customer
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setIsCreateProfileOpen(true)}
                leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              >
                Initialize Profile
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="error" title="Unable to load customer profile" className="mb-4">
                {error}
                <Button size="sm" variant="outline" className="mt-3" onClick={loadCustomer}>
                  Retry
                </Button>
              </Alert>
            )}
            {isLoading ? (
              <Spinner size="md" label="Loading customer profile..." />
            ) : error ? null : customer ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-400 text-[11px]">Customer Entity ID</p>
                  <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {customer.id}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px]">Registered Name</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {customer.displayName}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px]">Contact Email</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{customer.email}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px]">Created At</p>
                  <p className="text-slate-600 dark:text-slate-400">{formatDate(customer.createdAt)}</p>
                </div>
              </div>
            ) : (
              <Alert variant="info">
                You have not yet created a customer profile linked to your user account. Click "Initialize Profile" above to establish your verified customer record.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Security & Compliance Session Details</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Authentication: <strong>Stateful HttpOnly session cookie (KYC_SESSION)</strong> managed by Spring Security.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              CSRF Protection: <strong>Double-submit token pattern (X-XSRF-TOKEN)</strong> synchronized per session.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Document Storage: <strong>AES-256-GCM encrypted at rest</strong> outside public web root.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Edit Customer Modal */}
      <EditCustomerModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        customer={customer}
        onSuccess={() => loadCustomer()}
      />

      {/* Create Customer Profile Modal */}
      <CreateCustomerModal
        isOpen={isCreateProfileOpen}
        onClose={() => setIsCreateProfileOpen(false)}
        onSuccess={() => loadCustomer()}
      />
    </div>
  );
}
