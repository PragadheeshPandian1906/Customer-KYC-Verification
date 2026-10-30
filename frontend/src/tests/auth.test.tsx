import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/lib/theme/ThemeContext';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { api } from '@/lib/api/client';

describe('Authentication & Login Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders login form elements with accessible inputs', () => {
    // Mock /api/v1/auth/csrf and /api/v1/auth/me
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'mock-csrf' }),
        });
      }
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ title: 'Unauthorized', detail: 'Authentication required' }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('validates password length of at least 12 characters', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'mock-csrf' }),
        });
      }
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ title: 'Unauthorized' }),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: 'analyst@example.test' } });
    fireEvent.change(passInput, { target: { value: 'shortpass' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Password must be at least 12 characters/i)).toBeInTheDocument();
  });

  it('handles unsuccessful authentication (401 invalid credentials)', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'mock-csrf' }),
        });
      }
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ title: 'Unauthorized' }),
        });
      }
      if (url.includes('/api/v1/auth/login')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/problem+json' }),
          json: () =>
            Promise.resolve({
              title: 'Unauthorized',
              status: 401,
              detail: 'Invalid credentials provided',
              correlationId: 'trace-12345',
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: 'analyst@example.test' } });
    fireEvent.change(passInput, { target: { value: 'IncorrectPassword123' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Invalid credentials provided/i)).toBeInTheDocument();
    expect(screen.getByText(/Trace ID: trace-12345/i)).toBeInTheDocument();
  });

  it('submits valid login request and updates authentication state', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'csrf-valid' }),
        });
      }
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ title: 'Unauthorized' }),
        });
      }
      if (url.includes('/api/v1/auth/login')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () =>
            Promise.resolve({
              id: 'user-analyst-1',
              email: 'analyst@example.test',
              displayName: 'Fictional Analyst',
              roles: ['KYC_ANALYST'],
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    render(
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: 'analyst@example.test' } });
    fireEvent.change(passInput, { target: { value: 'ValidPassword123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/auth/login',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });
  });

  it('shows a recoverable session error instead of redirecting on a network failure', async () => {
      let meRequests = 0;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/auth/csrf')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'csrf' }) });
        }
        if (url.includes('/api/v1/auth/me')) {
          meRequests += 1;
          if (meRequests === 1) return Promise.reject(new TypeError('Failed to fetch'));
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              id: 'user-1',
              email: 'user@example.test',
              displayName: 'Test User',
              roles: ['KYC_ANALYST'],
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled: ${url}`));
      });

      render(
        <MemoryRouter initialEntries={['/private']}>
          <AuthProvider>
            <Routes>
              <Route path="/private" element={<ProtectedRoute><div>Private content</div></ProtectedRoute>} />
              <Route path="/login" element={<div>Login destination</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(await screen.findByText(/Unable to verify your session/i)).toBeInTheDocument();
      expect(screen.queryByText('Login destination')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Retry session check/i }));
      expect(await screen.findByText('Private content')).toBeInTheDocument();
    });

  it('redirects protected content when an API request confirms the session expired', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/auth/csrf')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'csrf' }) });
        }
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              id: 'user-1',
              email: 'user@example.test',
              displayName: 'Test User',
              roles: ['KYC_ANALYST'],
            }),
          });
        }
        if (url.includes('/api/v1/session-check')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            headers: new Headers({ 'content-type': 'application/problem+json' }),
            json: () => Promise.resolve({ status: 401, title: 'Unauthorized', detail: 'Session expired' }),
          });
        }
        return Promise.reject(new Error(`Unhandled: ${url}`));
      });

      function PrivateContent() {
        return (
          <div>
            <span>Private content</span>
            <button onClick={() => api.get('/api/v1/session-check').catch(() => undefined)}>Check session</button>
          </div>
        );
      }

      render(
        <MemoryRouter initialEntries={['/private']}>
          <AuthProvider>
            <Routes>
              <Route path="/private" element={<ProtectedRoute><PrivateContent /></ProtectedRoute>} />
              <Route path="/login" element={<div>Login destination</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.click(await screen.findByRole('button', { name: /Check session/i }));
      expect(await screen.findByText('Login destination')).toBeInTheDocument();
    });

  it('hides demo autofill controls in production mode', async () => {
      vi.stubEnv('DEV', false);
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/auth/csrf')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'csrf' }) });
        }
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            headers: new Headers({ 'content-type': 'application/problem+json' }),
            json: () => Promise.resolve({ status: 401, title: 'Unauthorized' }),
          });
        }
        return Promise.reject(new Error(`Unhandled: ${url}`));
      });

      render(
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider><LoginPage /></AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      );

      expect(screen.queryByText(/Local Development Demo Accounts/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/DemoPassword123/i)).not.toBeInTheDocument();
      vi.unstubAllEnvs();
    });
});
