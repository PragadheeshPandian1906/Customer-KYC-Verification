import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { ThemeProvider } from '@/lib/theme/ThemeContext';
import { AppLayout } from '@/components/shared/AppLayout';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';

import { LoginPage } from '@/features/auth/LoginPage';
import { AccessDeniedPage } from '@/features/auth/AccessDeniedPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { CasesPage } from '@/features/cases/CasesPage';
import { CaseDetailPage } from '@/features/cases/CaseDetailPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { AuditEventsPage } from '@/features/audit/AuditEventsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/access-denied" element={<AccessDeniedPage />} />

              {/* Protected Workspace Layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* Case Routes */}
                <Route
                  path="/cases"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'KYC_ANALYST', 'COMPLIANCE_SUPERVISOR']}>
                      <CasesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cases/:caseId"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'KYC_ANALYST', 'COMPLIANCE_SUPERVISOR']}>
                      <CaseDetailPage />
                    </ProtectedRoute>
                  }
                />

                {/* Customer Routes */}
                <Route
                  path="/customers"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'KYC_ANALYST', 'COMPLIANCE_SUPERVISOR']}>
                      <CustomersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customers/:customerId"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'KYC_ANALYST', 'COMPLIANCE_SUPERVISOR']}>
                      <CustomerDetailPage />
                    </ProtectedRoute>
                  }
                />

                {/* Supervisor Approval Queue */}
                <Route
                  path="/approvals"
                  element={
                    <ProtectedRoute allowedRoles={['COMPLIANCE_SUPERVISOR']}>
                      <ApprovalsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Profile Route */}
                <Route path="/profile" element={<ProfilePage />} />
                <Route
                  path="/admin/audit-events"
                  element={
                    <ProtectedRoute allowedRoles={['API_CLIENT_ADMIN']}>
                      <AuditEventsPage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
