import { useState } from 'react';
import { labels, type Job, type JobStatus } from '../types';

export function JobList({ jobs, busy, onStatus, onDelete }: { jobs: Job[]; busy: string | null; onStatus: (job: Job, status: JobStatus) => Promise<boolean>; onDelete: (job: Job) => Promise<boolean> }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  return <ul className="divide-y divide-stone-200" aria-label="Jobs">
    {jobs.map(job => <li key={job.id} className="job-row">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5"><h3 className="break-words font-semibold text-stone-800 [overflow-wrap:anywhere]">{job.title}</h3><span className={`status-badge status-${job.status}`}><span />{labels[job.status]}</span></div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500"><span className="max-w-full break-words rounded-md border border-stone-200 px-2 py-1 [overflow-wrap:anywhere]">{job.type}</span><time dateTime={job.createdAt} title={new Date(job.createdAt).toLocaleString()}>{new Date(job.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><span title={job.id} className="font-mono text-stone-400">#{job.id.slice(0, 8)}</span></div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {confirmId === job.id ? <div className="flex flex-wrap items-center gap-2 text-xs"><span>Delete this job?</span><button className="danger-button" disabled={!!busy} onClick={async () => { if (await onDelete(job)) setConfirmId(null); }} aria-label={`Confirm delete ${job.title}`}>Confirm</button><button className="small-button" disabled={!!busy} onClick={() => setConfirmId(null)}>Cancel</button></div> : <>
          {job.status === 'pending' && <button className="small-button" disabled={!!busy} aria-label={`Start ${job.title}`} onClick={() => void onStatus(job, 'running')}>{busy === job.id ? 'Saving…' : 'Start →'}</button>}
          {job.status === 'running' && <><button className="small-button" disabled={!!busy} aria-label={`Complete ${job.title}`} onClick={() => void onStatus(job, 'completed')}>Complete</button><button className="small-button text-red-700" disabled={!!busy} aria-label={`Mark ${job.title} failed`} onClick={() => void onStatus(job, 'failed')}>Fail</button></>}
          {(job.status === 'completed' || job.status === 'failed') && <span className="mr-1 text-xs text-stone-400">Finished</span>}
          <button className="delete-button" disabled={!!busy} aria-label={`Delete ${job.title}`} title="Delete job" onClick={() => setConfirmId(job.id)}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" /></svg></button>
        </>}
      </div>
    </li>)}
  </ul>;
}
