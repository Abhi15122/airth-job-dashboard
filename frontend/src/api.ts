import type { CreateJobInput, Job, JobStatus } from './types';

const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new ApiError('Cannot reach the API. It may be waking up; wait a moment and try again. If this followed an action, refresh before retrying.', 0);
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}). Please try again.`;
    try {
      const body = await response.json();
      if (Array.isArray(body.message)) message = body.message.join(' ');
      else if (typeof body.message === 'string') message = body.message;
    } catch { /* A proxy may return an HTML error. */ }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const jobsApi = {
  list: () => apiRequest<Job[]>('/jobs'),
  create: (input: CreateJobInput) => apiRequest<Job>('/jobs', { method: 'POST', body: JSON.stringify(input) }),
  updateStatus: (id: string, status: JobStatus) => apiRequest<Job>(`/jobs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete: (id: string) => apiRequest<void>(`/jobs/${id}`, { method: 'DELETE' }),
};
