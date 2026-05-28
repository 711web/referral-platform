'use client';

import { useActionState } from 'react';
import { updateLinkAction, deleteLinkAction, type UpdateLinkState } from '../../actions';

const initial: UpdateLinkState = {};

export function EditLinkForm(props: { id: string; slug: string; destinationUrl: string }) {
  const [state, formAction, pending] = useActionState(updateLinkAction, initial);
  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={props.id} />
        <label className="flex flex-col gap-1 text-sm">
          Slug
          <input
            disabled
            value={props.slug}
            className="rounded-md border border-[var(--border)] bg-slate-50 px-3 py-2 text-[var(--muted)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Destination URL
          <input
            name="destinationUrl"
            type="url"
            required
            defaultValue={props.destinationUrl}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>
      <form action={deleteLinkAction}>
        <input type="hidden" name="id" value={props.id} />
        <button
          type="submit"
          onClick={(e) => {
            if (!confirm('Delete this link? Click history will be removed.')) e.preventDefault();
          }}
          className="text-sm text-red-600 underline"
        >
          Delete link
        </button>
      </form>
    </div>
  );
}
