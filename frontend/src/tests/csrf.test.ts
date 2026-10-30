import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '@/lib/api/csrf';
import { request } from '@/lib/api/client';

function response(body: unknown, status = 200): Response {
  const headers = new Headers({
    'content-type': status >= 400 ? 'application/problem+json' : 'application/json',
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 403 ? 'Forbidden' : 'OK',
    headers,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    clone: () => response(body, status),
  } as Response;
}

describe('CSRF request handling', () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  it('uses the backend-provided header and retries once only for a CSRF filter rejection', async () => {
    let tokenRequests = 0;
    const mutationHeaders: Headers[] = [];
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/v1/auth/csrf')) {
        tokenRequests += 1;
        return Promise.resolve(response({
          headerName: 'X-APP-CSRF',
          token: tokenRequests === 1 ? 'stale-token' : 'fresh-token',
        }));
      }
      mutationHeaders.push(new Headers(init?.headers));
      return Promise.resolve(mutationHeaders.length === 1
        ? response({ status: 403, detail: 'CSRF rejected', code: 'CSRF_INVALID' }, 403)
        : response({ saved: true }));
    });

    await expect(request('/api/v1/customer/action', {
      method: 'POST',
      body: { message: 'one submission' },
    })).resolves.toEqual({ saved: true });

    expect(tokenRequests).toBe(2);
    expect(mutationHeaders).toHaveLength(2);
    expect(mutationHeaders[0].get('X-APP-CSRF')).toBe('stale-token');
    expect(mutationHeaders[1].get('X-APP-CSRF')).toBe('fresh-token');
  });

  it('does not retry a mutation after an authorization-denied 403', async () => {
    let mutationCount = 0;
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/api/v1/auth/csrf')) {
        return Promise.resolve(response({ headerName: 'X-XSRF-TOKEN', token: 'valid-token' }));
      }
      mutationCount += 1;
      return Promise.resolve(response({
        status: 403,
        detail: 'The current role is not permitted',
      }, 403));
    });

    await expect(request('/api/v1/restricted/action', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 403 });
    expect(mutationCount).toBe(1);
  });
});
