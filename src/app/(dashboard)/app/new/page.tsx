'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createLinkAction, type CreateLinkState } from '../actions';

const initial: CreateLinkState = {};

export default function NewLinkPage() {
  const [state, formAction, pending] = useActionState(createLinkAction, initial);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">New link</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Slug
          <input
            name="slug"
            required
            pattern="[A-Za-z0-9\-]{2,40}"
            placeholder="my-promo"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Destination URL
          <input
            name="destinationUrl"
            type="url"
            required
            placeholder="https://example.com/landing"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Creating…' : 'Create'}
          </button>
          <Link
            href="/app"
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
