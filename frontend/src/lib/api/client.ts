import { ApiError } from './errors';
import { getCsrfToken, clearCsrfToken } from './csrf';
import { PageResponse, ProblemDetail } from '@/types/common';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  idempotencyKey?: string;
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
      headers.set('X-XSRF-TOKEN', csrfToken);
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

  // Handle 403 CSRF token mismatch: try once with a refreshed CSRF token
  if (response.status === 403 && requiresCsrf) {
    clearCsrfToken();
    try {
      const refreshedCsrf = await getCsrfToken(true);
      headers.set('X-XSRF-TOKEN', refreshedCsrf);
      response = await fetch(url, {
        ...init,
        method,
        headers,
        body: bodyData,
        credentials: 'include',
      });
    } catch {
      // Continue to error handling below
    }
  }

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
    const totalPages = Math.max(1, firstPage.totalPages || 1);
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
