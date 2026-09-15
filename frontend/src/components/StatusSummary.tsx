import { labels, statuses, type Job, type StatusFilter } from '../types';

export function StatusSummary({ jobs, filter, onFilter, loaded }: { jobs: Job[]; filter: StatusFilter; onFilter: (status: StatusFilter) => void; loaded: boolean }) {
  const descriptions = { pending: 'Ready when you are', running: 'Work in progress', completed: 'Successfully finished', failed: 'Finished with an issue' };
  return <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Job counts">
    {statuses.map(status => <button key={status} onClick={() => onFilter(filter === status ? 'all' : status)} aria-pressed={filter === status} aria-label={`Filter ${labels[status]} jobs`} className={`summary-card ${filter === status ? 'summary-selected' : ''}`}>
      <span className={`status-badge status-${status}`}><span />{labels[status]}</span>
      <strong className="mt-4 block text-4xl font-medium tabular-nums tracking-tight" data-testid={`count-${status}`}>{loaded ? jobs.filter(job => job.status === status).length : '—'}</strong>
      <span className="mt-2 block text-xs text-stone-500">{descriptions[status]}</span>
    </button>)}
  </section>;
}
