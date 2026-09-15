import { useForm } from 'react-hook-form';
import type { CreateJobInput } from '../types';

export function CreateJobForm({ onCreate, disabled }: { onCreate: (input: CreateJobInput) => Promise<boolean>; disabled: boolean }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateJobInput>({ defaultValues: { title: '', type: '' } });
  const submit = handleSubmit(async input => {
    if (await onCreate({ title: input.title.trim(), type: input.type.trim() })) reset();
  });

  return <section className="panel h-fit" aria-labelledby="create-heading">
    <div className="border-b border-stone-200 p-6">
      <span className="eyebrow">ADD TO YOUR QUEUE</span>
      <h2 id="create-heading" className="mt-2 text-xl font-semibold tracking-tight">Create a job</h2>
      <p className="mt-2 text-sm leading-6 text-stone-500">Give your next piece of work a name.</p>
    </div>
    <form onSubmit={submit} noValidate className="space-y-5 p-6">
      <div>
        <label className="field-label" htmlFor="job-title">Job title</label>
        <input id="job-title" className="field" placeholder="e.g. Generate weekly report" autoComplete="off" aria-invalid={!!errors.title} aria-describedby={errors.title ? 'title-error' : 'title-hint'} {...register('title', { validate: value => (value.trim().length > 0 && [...value.trim()].length <= 120) || 'Enter a title between 1 and 120 characters.' })} />
        {errors.title ? <p className="field-error" id="title-error">{errors.title.message}</p> : <p className="field-hint" id="title-hint">A short, descriptive name. Up to 120 characters.</p>}
      </div>
      <div>
        <label className="field-label" htmlFor="job-type">Job type</label>
        <input id="job-type" className="field" placeholder="e.g. Report, email, export" autoComplete="off" aria-invalid={!!errors.type} aria-describedby={errors.type ? 'type-error' : 'type-hint'} {...register('type', { validate: value => (value.trim().length > 0 && [...value.trim()].length <= 50) || 'Enter a type between 1 and 50 characters.' })} />
        {errors.type ? <p className="field-error" id="type-error">{errors.type.message}</p> : <p className="field-hint" id="type-hint">Choose your own category. Up to 50 characters.</p>}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3 text-sm"><span className="text-stone-500">Initial status</span><span className="status-badge status-pending"><span />Pending</span></div>
      <button className="primary-button w-full" disabled={disabled || isSubmitting} type="submit">{isSubmitting ? 'Creating…' : '+ Create job'}</button>
      <p className="text-center text-xs leading-5 text-stone-500">Jobs are tracked here. Status changes are manual.</p>
    </form>
  </section>;
}
