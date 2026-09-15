import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { ApiError, jobsApi } from '../api';
import type { Job } from '../types';

vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), jobsApi: { list: vi.fn(), create: vi.fn(), updateStatus: vi.fn(), delete: vi.fn() } }));
const first: Job = { id: '11111111-1111-4111-8111-111111111111', title: 'Weekly report', type: 'report', status: 'pending', createdAt: '2026-09-15T10:00:00Z' };
const second: Job = { ...first, id: '22222222-2222-4222-8222-222222222222', title: 'Export customers', type: 'export', status: 'completed' };
let data: Job[];
beforeEach(() => {
  data = [{ ...first }, { ...second }];
  vi.mocked(jobsApi.list).mockImplementation(async () => [...data]);
  vi.mocked(jobsApi.create).mockImplementation(async input => { const job = { ...first, id: '33333333-3333-4333-8333-333333333333', ...input }; data.unshift(job); return job; });
  vi.mocked(jobsApi.updateStatus).mockImplementation(async (id, status) => { const job = { ...data.find(item => item.id === id)!, status }; data = data.map(item => item.id === id ? job : item); return job; });
  vi.mocked(jobsApi.delete).mockImplementation(async id => { data = data.filter(item => item.id !== id); });
});

describe('Dashboard behavior', () => {
  it('loads jobs, shows global counts and filters without changing counts', async () => {
    const user = userEvent.setup(); render(<App />);
    expect(screen.getByText('Loading your jobs…')).toBeInTheDocument();
    await screen.findByText('Weekly report');
    await user.click(within(screen.getByRole('group', { name: 'Filter by status' })).getByRole('button', { name: 'Completed' }));
    expect(screen.queryByText('Weekly report')).not.toBeInTheDocument();
    expect(screen.getByText('Export customers')).toBeInTheDocument();
    expect(screen.getByTestId('count-pending')).toHaveTextContent('1');
    expect(screen.getByTestId('count-completed')).toHaveTextContent('1');
  });

  it('rejects whitespace-only form inputs without calling the API', async () => {
    const user = userEvent.setup(); render(<App />); await screen.findByText('Weekly report');
    await user.type(screen.getByLabelText('Job title'), '   ');
    await user.click(screen.getByRole('button', { name: '+ Create job' }));
    expect(await screen.findByText('Enter a title between 1 and 120 characters.')).toBeInTheDocument();
    expect(jobsApi.create).not.toHaveBeenCalled();
  });

  it('creates with trimmed input and clears the form after success', async () => {
    const user = userEvent.setup(); render(<App />); await screen.findByText('Weekly report');
    await user.type(screen.getByLabelText('Job title'), '  Send digest  ');
    await user.type(screen.getByLabelText('Job type'), ' email ');
    await user.click(screen.getByRole('button', { name: '+ Create job' }));
    expect(await screen.findByText('Send digest')).toBeInTheDocument();
    expect(jobsApi.create).toHaveBeenCalledWith({ title: 'Send digest', type: 'email' });
    await waitFor(() => expect(screen.getByLabelText('Job title')).toHaveValue(''));
  });

  it('keeps input after a failed create', async () => {
    vi.mocked(jobsApi.create).mockRejectedValueOnce(new ApiError('Server unavailable', 500));
    const user = userEvent.setup(); render(<App />); await screen.findByText('Weekly report');
    await user.type(screen.getByLabelText('Job title'), 'Keep this input');
    await user.type(screen.getByLabelText('Job type'), 'report');
    await user.click(screen.getByRole('button', { name: '+ Create job' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    expect(screen.getByLabelText('Job title')).toHaveValue('Keep this input');
  });

  it('recovers from an initial API failure with retry', async () => {
    vi.mocked(jobsApi.list).mockRejectedValueOnce(new ApiError('Cannot reach API', 0));
    const user = userEvent.setup(); render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach API');
    await user.click(screen.getByRole('button', { name: 'Retry loading jobs' }));
    expect(await screen.findByText('Weekly report')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('moves pending to running and never offers restart for a terminal job', async () => {
    const user = userEvent.setup(); render(<App />); await screen.findByText('Weekly report');
    expect(screen.queryByRole('button', { name: 'Start Export customers' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Weekly report' }));
    expect(await screen.findByRole('button', { name: 'Complete Weekly report' })).toBeInTheDocument();
    expect(jobsApi.updateStatus).toHaveBeenCalledWith(first.id, 'running');
  });

  it('refreshes after a conflict and shows the server error', async () => {
    vi.mocked(jobsApi.updateStatus).mockImplementationOnce(async () => { data[0] = { ...first, status: 'running' }; throw new ApiError('Another request changed this job.', 409); });
    const user = userEvent.setup(); render(<App />); await screen.findByText('Weekly report');
    await user.click(screen.getByRole('button', { name: 'Start Weekly report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Another request changed this job.');
    expect(await screen.findByRole('button', { name: 'Complete Weekly report' })).toBeInTheDocument();
  });

  it('requires confirmation before deletion and supports cancellation', async () => {
    const user = userEvent.setup(); render(<App />); await screen.findByText('Weekly report');
    await user.click(screen.getByRole('button', { name: 'Delete Weekly report' }));
    expect(jobsApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Delete this job?')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete Weekly report' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete Weekly report' }));
    await waitFor(() => expect(screen.queryByText('Weekly report')).not.toBeInTheDocument());
    expect(jobsApi.delete).toHaveBeenCalledWith(first.id);
  });

  it('disables further actions during an in-flight mutation', async () => {
    let resolve!: (job: Job) => void;
    vi.mocked(jobsApi.updateStatus).mockReturnValueOnce(new Promise<Job>(done => { resolve = done; }));
    const user = userEvent.setup(); render(<App />); await screen.findByText('Weekly report');
    await user.click(screen.getByRole('button', { name: 'Start Weekly report' }));
    expect(screen.getByRole('button', { name: 'Start Weekly report' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '+ Create job' })).toBeDisabled();
    resolve({ ...first, status: 'running' });
    await screen.findByText('Job marked running.');
  });
});
