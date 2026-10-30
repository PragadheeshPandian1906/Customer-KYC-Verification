import { ApiError } from './errors';
import { getCsrfToken, clearCsrfToken } from './csrf';
import { PageResponse, ProblemDetail } from '@/types/common';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  idempotencyKey?: string;
}

export const SESSION_EXPIRED_EVENT = 'kyc:session-expired';

function notifySessionExpired(response: Response): void {
  if (response.status === 401) {
    clearCsrfToken();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions & { body?: unknown; isFormData?: boolean } = {}
): Promise<T> {
  const { params, idempotencyKey, isFormData, headers: customHeaders, ...init } = options;

  let url = path;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const method = (init.method || 'GET').toUpperCase();
  const requiresCsrf = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

  const headers = new Headers(customHeaders || {});
  headers.set('Accept', 'application/json, application/problem+json');

  if (idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey);
  }

  if (requiresCsrf) {
    try {
      const csrfToken = await getCsrfToken();
      headers.set(csrfToken.headerName, csrfToken.token);
    } catch (err) {
      throw new ApiError(0, {
        status: 0,
        detail: err instanceof Error ? err.message : 'Unable to initialize request security',
        title: 'Security Initialization Failed',
      });
    }
  }

  let bodyData: BodyInit | undefined = undefined;
  if (isFormData && options.body instanceof FormData) {
    bodyData = options.body;
    // Note: Do not set Content-Type header when sending FormData so browser sets boundary automatically
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    bodyData = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      method,
      headers,
      body: bodyData,
      credentials: 'include',
    });
  } catch (netErr) {
    throw new ApiError(0, {
      status: 0,
      detail: netErr instanceof Error ? netErr.message : 'Network connection failed',
      title: 'Network Error',
    });
  }

  // The backend marks CSRF-filter rejections separately from authorization denials.
  if (response.status === 403 && requiresCsrf) {
    const problemResponse = response.clone();
    let csrfRejected = false;
    try {
      const problem = await problemResponse.json() as { code?: string };
      csrfRejected = problem.code === 'CSRF_INVALID';
    } catch {
      csrfRejected = false;
    }

    if (csrfRejected) {
      clearCsrfToken();
      const refreshedCsrf = await getCsrfToken(true);
      headers.set(refreshedCsrf.headerName, refreshedCsrf.token);
      try {
        response = await fetch(url, {
          ...init,
          method,
          headers,
          body: bodyData,
          credentials: 'include',
        });
      } catch (netErr) {
        throw new ApiError(0, {
          status: 0,
          detail: netErr instanceof Error ? netErr.message : 'Network connection failed',
          title: 'Network Error',
        });
      }
    }
  }

  notifySessionExpired(response);

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    let errorDetail: ProblemDetail;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('application/problem+json')) {
      try {
        errorDetail = await response.json();
      } catch {
        errorDetail = {
          status: response.status,
          title: response.statusText,
          detail: 'Failed to parse server error response',
        };
      }
    } else {
      const text = await response.text();
      errorDetail = {
        status: response.status,
        title: response.statusText,
        detail: text || response.statusText,
      };
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}

export const api = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: 'GET' });
  },

  async getAllPages<T>(path: string, options?: RequestOptions): Promise<T[]> {
    const pageSize = 100;
    const firstPage = await request<PageResponse<T>>(path, {
      ...options,
      method: 'GET',
      params: { ...options?.params, page: 0, size: pageSize },
    });
    const pages = [firstPage];
    const reportedTotalPages = Number(firstPage.totalPages);
    const totalPages = Number.isFinite(reportedTotalPages)
      ? Math.max(1, Math.floor(reportedTotalPages))
      : 1;
    for (let pageNumber = 1; pageNumber < totalPages; pageNumber += 1) {
      pages.push(await request<PageResponse<T>>(path, {
        ...options,
        method: 'GET',
        params: { ...options?.params, page: pageNumber, size: pageSize },
      }));
    }
    return pages.flatMap((page) => page.content);
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: 'POST', body });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: 'PATCH', body });
  },

  upload<T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: 'POST', body: formData, isFormData: true });
  },

  async download(
    path: string,
    options?: RequestOptions
  ): Promise<{ blob: Blob; filename: string; contentType: string }> {
    const { params, headers: customHeaders, ...init } = options || {};

    let url = path;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const headers = new Headers(customHeaders || {});
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        method: 'GET',
        headers,
        credentials: 'include',
      });
    } catch (netErr) {
      throw new ApiError(0, {
        status: 0,
        detail: netErr instanceof Error ? netErr.message : 'Network connection failed',
        title: 'Network Error',
      });
    }

    notifySessionExpired(response);

    if (!response.ok) {
      let problem: ProblemDetail;
      try {
        problem = await response.json();
      } catch {
        problem = {
          status: response.status,
          title: response.statusText,
          detail: 'Failed to download document',
        };
      }
      throw new ApiError(response.status, problem);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    let filename = 'document';
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    if (match && match[1]) {
      try {
        filename = decodeURIComponent(match[1]);
      } catch {
        filename = match[1];
      }
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return { blob, filename, contentType };
  },
};
