import { CsrfResponse } from '@/types/auth';

let cachedToken: string | null = null;
let pendingFetch: Promise<string> | null = null;

export async function getCsrfToken(forceRefresh = false): Promise<string> {
  if (cachedToken && !forceRefresh) {
    return cachedToken;
  }

  if (pendingFetch && !forceRefresh) {
    return pendingFetch;
  }

  pendingFetch = (async () => {
    try {
      const response = await fetch('/api/v1/auth/csrf', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }

      const data: CsrfResponse = await response.json();
      cachedToken = data.token;
      return data.token;
    } finally {
      pendingFetch = null;
    }
  })();

  return pendingFetch;
}

export function clearCsrfToken(): void {
  cachedToken = null;
}
