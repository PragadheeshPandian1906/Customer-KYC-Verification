import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

export function AccessDeniedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <Card className="w-full max-w-md border-rose-200 dark:border-rose-900/50 shadow-xl">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Access Restricted
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Your current role(s) <span className="font-mono font-semibold">[{user?.roles?.join(', ')}]</span> do not possess authorization to access this KYC resource or workflow.
          </p>
          <div className="pt-2 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
