'use client';

import { useActionState } from 'react';
import { updateCampaignAction, type CampaignFormState } from '../actions';

const initial: CampaignFormState = {};

type Defaults = {
  name: string;
  landingUrl: string;
  commissionPct: string;
  tags: string;
  brief: string;
  status: 'draft' | 'live' | 'paused' | 'ended';
};

export function EditCampaignForm({ id, defaults }: { id: string; defaults: Defaults }) {
  const [state, action, pending] = useActionState(updateCampaignAction, initial);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          required
          defaultValue={defaults.name}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Landing URL
        <input
          name="landingUrl"
          type="url"
          required
          defaultValue={defaults.landingUrl}
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
          defaultValue={defaults.commissionPct}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tags
        <input
          name="tags"
          defaultValue={defaults.tags}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Brief
        <textarea
          name="brief"
          rows={4}
          defaultValue={defaults.brief}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Status
        <select
          name="status"
          defaultValue={defaults.status}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        >
          <option value="draft">Draft</option>
          <option value="live">Live</option>
          <option value="paused">Paused</option>
          <option value="ended">Ended</option>
        </select>
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
