export const statuses = ['pending', 'running', 'completed', 'failed'] as const;
export type JobStatus = typeof statuses[number];
export type StatusFilter = JobStatus | 'all';
export interface Job { id: string; title: string; type: string; status: JobStatus; createdAt: string }
export interface CreateJobInput { title: string; type: string }
export const labels: Record<JobStatus, string> = { pending: 'Pending', running: 'Running', completed: 'Completed', failed: 'Failed' };
