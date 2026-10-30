import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { RoleCode } from '@/types/auth';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: RoleCode[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, authError, refreshUser, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner size="lg" label="Validating compliance session..." />
      </div>
    );
  }

  if (!isAuthenticated && authError) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Alert variant="error" title="Unable to verify your session">
          <p>{authError}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => refreshUser()}>
            Retry session check
          </Button>
        </Alert>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasPermission = user?.roles?.some((role) => allowedRoles.includes(role));
    if (!hasPermission) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  return <>{children}</>;
}
