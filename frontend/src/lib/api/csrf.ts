import { CsrfResponse } from '@/types/auth';

export interface CsrfTokenValue {
  headerName: string;
  token: string;
}

let cachedToken: CsrfTokenValue | null = null;
let pendingFetch: Promise<CsrfTokenValue> | null = null;

export async function getCsrfToken(forceRefresh = false): Promise<CsrfTokenValue> {
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
      if (!data.headerName || !data.token) {
        throw new Error('CSRF endpoint returned an incomplete token configuration');
      }
      cachedToken = { headerName: data.headerName, token: data.token };
      return cachedToken;
    } finally {
      pendingFetch = null;
    }
  })();

  return pendingFetch;
}

export function clearCsrfToken(): void {
  cachedToken = null;
}
