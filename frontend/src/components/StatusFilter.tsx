import { labels, statuses, type StatusFilter as Filter } from '../types';

export function StatusFilter({ value, onChange }: { value: Filter; onChange: (value: Filter) => void }) {
  return <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
    {(['all', ...statuses] as const).map(status => <button className={`filter-button ${value === status ? 'filter-active' : ''}`} key={status} aria-pressed={value === status} onClick={() => onChange(status)}>{status === 'all' ? 'All jobs' : labels[status]}</button>)}
  </div>;
}
