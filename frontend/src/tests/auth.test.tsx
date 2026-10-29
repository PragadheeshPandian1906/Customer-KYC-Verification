import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/lib/theme/ThemeContext';

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
});
