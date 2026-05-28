'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createCampaignAction, type CampaignFormState } from '../actions';

const initial: CampaignFormState = {};

export default function NewCampaignPage() {
  const [state, action, pending] = useActionState(createCampaignAction, initial);
  return (
    <div className="mx-auto max-w-md">
      <Link href="/app/campaigns" className="text-sm text-[var(--muted)] underline-offset-4 hover:underline">
        ← back
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">New campaign</h1>
      <form action={action} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            required
            placeholder="Summer Sale"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Landing URL
          <input
            name="landingUrl"
            type="url"
            required
            placeholder="https://yourbrand.com/landing"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Commission %
          <input
            name="commissionPct"
            type="number"
            min="0"
            max="100"
            step="0.1"
            defaultValue="10"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tags (comma-separated, used for matching)
          <input
            name="tags"
            placeholder="fashion, beauty, summer"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Brief
          <textarea
            name="brief"
            rows={4}
            placeholder="What you'd like creators to know"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select name="status" defaultValue="draft" className="rounded-md border border-[var(--border)] px-3 py-2">
            <option value="draft">Draft</option>
            <option value="live">Live</option>
          </select>
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Creating…' : 'Create campaign'}
          </button>
          <Link
            href="/app/campaigns"
            className="cursor-pointer rounded-md border border-[var(--border)] px-4 py-2 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
