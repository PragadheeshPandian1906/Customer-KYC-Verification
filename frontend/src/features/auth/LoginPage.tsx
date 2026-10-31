import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { ShieldCheck, Lock, Mail, Moon, Sun, KeyRound } from 'lucide-react';
import { ApiError, extractErrorMessage } from '@/lib/api/errors';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCorrelationId, setErrorCorrelationId] = useState<string | undefined>();

  // If already authenticated, redirect
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorCorrelationId(undefined);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address');
      return;
    }
    if (password.length < 12) {
      setErrorMessage('Password must be at least 12 characters');
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMessage(extractErrorMessage(err));
      setErrorCorrelationId(err instanceof ApiError ? err.correlationId : undefined);
    } finally {
      setIsLoading(false);
    }
  };

  const SHandleDemoFill = (demoEmail: string) => {
    setEmail(demoEmail);
    // Provide a sample 12+ character placeholder password
    setPassword('Supervisor@123456');
  };

  const AnHandleDemoFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Analyst@123456');
  };

  const AdHandleDemoFill = (demoEmail: string) =>{
    setEmail(demoEmail);
    setPassword('Admin@123456');
  }

  const CHandleDemoFill = (demoEmail:string) => {
    setEmail(demoEmail);
    setPassword('Customer@123456');
  }



  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            KYC Verification Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Secure compliance and identity verification gateway
          </p>
        </div>

        <Card className="shadow-xl border-slate-200/90 dark:border-slate-800">
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>
              Enter your authorized enterprise credentials to authenticate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <Alert
                variant="error"
                title="Authentication Failed"
                className="mb-4"
                correlationId={errorCorrelationId}
              >
                {errorMessage}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                required
                autoComplete="email"
                placeholder="analyst@example.test"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                disabled={isLoading}
              />

              <Input
                label="Password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                helperText="Minimum 12 characters"
                disabled={isLoading}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isLoading}
                leftIcon={<KeyRound className="w-4 h-4" />}
              >
                Sign In
              </Button>
            </form>

            {import.meta.env.DEV && (
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 text-center">
                  Local Development Demo Accounts
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => SHandleDemoFill('supervisor@example.test')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 text-left transition-colors"
                  >
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Supervisor</p>
                    <p className="text-[10px] text-slate-500 truncate">supervisor@example.test</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => AnHandleDemoFill('analyst@example.test')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 text-left transition-colors"
                  >
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Analyst</p>
                    <p className="text-[10px] text-slate-500 truncate">analyst@example.test</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => CHandleDemoFill('customer@example.test')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 text-left transition-colors"
                  >
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Customer</p>
                    <p className="text-[10px] text-slate-500 truncate">customer@example.test</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => AdHandleDemoFill('admin@example.test')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 text-left transition-colors"
                  >
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Admin</p>
                    <p className="text-[10px] text-slate-500 truncate">admin@example.test</p>
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
