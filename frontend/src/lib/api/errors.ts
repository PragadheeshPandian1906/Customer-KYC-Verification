import { ProblemDetail } from '@/types/common';

export class ApiError extends Error {
  public status: number;
  public title: string;
  public correlationId?: string;
  public errors?: Record<string, string>;
  public rawDetail: ProblemDetail;

  constructor(status: number, problem: ProblemDetail) {
    const message = problem.detail || problem.title || `Request failed with status ${status}`;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.title = problem.title || 'Error';
    this.correlationId = problem.correlationId;
    this.errors = problem.errors;
    this.rawDetail = problem;
  }
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errors && Object.keys(error.errors).length > 0) {
      const fieldErrors = Object.entries(error.errors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join('; ');
      return `${error.message} (${fieldErrors})`;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
