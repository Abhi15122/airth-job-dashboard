import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, jobsApi } from './api';
import { CreateJobForm } from './components/CreateJobForm';
import { JobList } from './components/JobList';
import { StatusFilter } from './components/StatusFilter';
import { StatusSummary } from './components/StatusSummary';
import { labels, type CreateJobInput, type Job, type JobStatus, type StatusFilter as Filter } from './types';

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const requestVersion = useRef(0);
  const mutationActive = useRef(false);

  const refresh = useCallback(async (clearError = true) => {
    const version = ++requestVersion.current;
    setRefreshing(true);
    if (clearError) setError('');
    try {
      const next = await jobsApi.list();
      if (version === requestVersion.current) { setJobs(next); setLoaded(true); setUpdatedAt(new Date()); }
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : 'Could not load jobs.');
    } finally {
      if (version === requestVersion.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => { if (!mutationActive.current) void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { ++requestVersion.current; window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  async function mutate(key: string, action: () => Promise<void>, success: string) {
    if (mutationActive.current) return false;
    mutationActive.current = true;
    ++requestVersion.current;
    setRefreshing(false);
    setBusy(key); setError(''); setNotice('');
    try {
      await action();
      setNotice(success);
      await refresh(false);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The action failed. Please try again.');
      if (cause instanceof ApiError && (cause.status === 409 || cause.status === 404)) await refresh(false);
      return false;
    } finally { mutationActive.current = false; setBusy(null); }
  }

  const create = (input: CreateJobInput) => mutate('create', async () => {
    const job = await jobsApi.create(input);
    setJobs(current => [job, ...current]);
  }, 'Job created. It is ready to start.');
  const changeStatus = (job: Job, status: JobStatus) => mutate(job.id, async () => {
    const updated = await jobsApi.updateStatus(job.id, status);
    setJobs(current => current.map(item => item.id === job.id ? updated : item));
  }, `Job marked ${status}.`);
  const deleteJob = (job: Job) => mutate(job.id, async () => {
    await jobsApi.delete(job.id);
    setJobs(current => current.filter(item => item.id !== job.id));
  }, 'Job deleted.');
  const visible = jobs.filter(job => filter === 'all' || job.status === filter);

  return <div className="min-h-screen">
    <header className="topbar"><div className="page-width flex items-center justify-between gap-4">
      <a href="#main" className="flex items-center gap-3 text-white" aria-label="AIRTH job queue"><span className="brand-mark">A</span><span className="text-xl font-bold tracking-[0.18em]">AIRTH<span className="ml-4 hidden border-l border-white/20 pl-4 text-xs font-normal tracking-normal text-white/60 sm:inline">Job Queue</span></span></a>
      <span className="flex items-center gap-2 text-xs text-white/70"><span className={`h-1.5 w-1.5 rounded-full ${error ? 'bg-amber-300' : loaded ? 'bg-lime-300' : 'bg-white/40'}`} />{error ? 'Needs attention' : loaded ? 'Queue connected' : 'Connecting'}</span>
    </div></header>
    <main id="main" className="page-width py-8 sm:py-11">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">WORKSPACE / OVERVIEW</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Your work, in motion.</h1><p className="mt-3 text-sm text-stone-500">A clear view of every job, from pending to done.</p></div><button className="secondary-button" onClick={() => void refresh()} disabled={refreshing || !!busy}><span aria-hidden="true" className={refreshing ? 'inline-block animate-spin' : ''}>↻</span> {refreshing ? 'Refreshing…' : 'Refresh jobs'}</button></div>
      <StatusSummary jobs={jobs} filter={filter} onFilter={setFilter} loaded={loaded} />
      {error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button className="font-semibold underline underline-offset-4 disabled:opacity-50" disabled={refreshing || !!busy} onClick={() => void refresh()}>Retry loading jobs</button></div>}
      <div role="status" aria-live="polite" className={notice ? 'mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800' : 'sr-only'}>{notice}</div>
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel overflow-hidden" aria-labelledby="queue-heading" aria-busy={refreshing}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-6 py-5"><div className="flex items-center gap-3"><h2 id="queue-heading" className="text-lg font-semibold">Job queue</h2><span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium tabular-nums text-stone-600">{loaded ? jobs.length : '—'}</span></div><span className="text-xs text-stone-400">Newest first</span></div>
          <div className="border-b border-stone-200 px-4 py-3"><StatusFilter value={filter} onChange={setFilter} /></div>
          {!loaded && refreshing ? <div role="status" className="px-6 py-16 text-center text-sm text-stone-500">Loading your jobs…</div> : !loaded ? <div className="px-6 py-16 text-center text-sm text-stone-500">Your queue could not be loaded. Use Retry above.</div> : visible.length ? <JobList jobs={visible} busy={busy} onStatus={changeStatus} onDelete={deleteJob} /> : <div className="px-6 py-16 text-center"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#edf2df] text-2xl text-[#52653b]" aria-hidden="true">≡</div><h3 className="font-semibold">{filter === 'all' ? 'A fresh start for your queue' : `No ${labels[filter].toLowerCase()} jobs`}</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-stone-500">{filter === 'all' ? 'Create your first job to start tracking work in one place.' : 'Try another status or create a new job.'}</p>{filter !== 'all' && <button className="small-button mt-5" onClick={() => setFilter('all')}>Show all jobs</button>}</div>}
          <div className="flex flex-wrap justify-between gap-2 border-t border-stone-200 bg-stone-50/60 px-6 py-3 text-xs text-stone-500"><span>{loaded ? `Showing ${visible.length} of ${jobs.length} jobs` : 'Waiting for jobs'}</span><span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Syncs when you return to this tab'}</span></div>
        </section>
        <div className="space-y-5"><CreateJobForm onCreate={create} disabled={!!busy} /><aside className="rounded-2xl border border-[#dfe6d5] bg-[#eff3e8] p-5"><h2 className="text-sm font-semibold text-[#405437]">One step at a time</h2><p className="mt-2 text-xs leading-6 text-[#617057]">Pending → Running → Completed or Failed.<br />Finished jobs stay finished. Create a new job to try again.</p></aside></div>
      </div>
      <footer className="mt-9 flex flex-wrap justify-between gap-2 text-xs text-stone-400"><span>AIRTH · Mini Job Queue Dashboard</span><span>Simple workflow. Clear progress.</span></footer>
    </main>
  </div>;
}
