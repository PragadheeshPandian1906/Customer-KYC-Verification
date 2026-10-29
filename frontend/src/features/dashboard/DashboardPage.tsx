import { useAuth } from '@/lib/auth/AuthContext';
import { CustomerDashboard } from './CustomerDashboard';
import { AnalystDashboard } from './AnalystDashboard';
import { SupervisorDashboard } from './SupervisorDashboard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ShieldAlert } from 'lucide-react';

export function DashboardPage() {
  const { isCustomer, isAnalyst, isSupervisor, isAdmin } = useAuth();

  if (isSupervisor) {
    return <SupervisorDashboard />;
  }

  if (isAnalyst) {
    return <AnalystDashboard />;
  }

  if (isCustomer) {
    return <CustomerDashboard />;
  }

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            API Client Administrator Console
          </h1>
          <p className="text-xs text-slate-500">
            Authenticated administrative gateway session.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Administrative Scope Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              In accordance with system security boundaries, users with role{' '}
              <span className="font-mono font-semibold">API_CLIENT_ADMIN</span> have no unrestricted customer or case data access.
            </p>
            <p>
              Client management and reference administration endpoints are backend internal services. To perform case reviews or customer onboarding, please authenticate with an operational role (<span className="font-semibold">KYC_ANALYST</span>, <span className="font-semibold">COMPLIANCE_SUPERVISOR</span>, or <span className="font-semibold">CUSTOMER</span>).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <CustomerDashboard />;
}
