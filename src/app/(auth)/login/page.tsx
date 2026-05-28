'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, type LoginState } from './actions';

const initial: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Log in</h1>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Logging in…' : 'Log in'}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        New here?{' '}
        <Link className="underline" href="/signup">
          Create an account
        </Link>
      </p>
    </form>
  );
}
