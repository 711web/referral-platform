import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ensureWorkspaceForUser } from '@/lib/workspaces/ensure';
import { logoutAction } from './app/actions';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  await ensureWorkspaceForUser(session.user.id, session.user.email);

  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr]">
      <aside className="flex flex-col border-r border-[var(--border)] bg-white p-4">
        <Link href="/app" className="block text-lg font-semibold">
          Partner
        </Link>
        <nav className="mt-6 flex flex-col gap-1 text-sm">
          <Link href="/app" className="rounded-md px-2 py-1 hover:bg-slate-100">
            Links
          </Link>
          <Link href="/app/conversions" className="rounded-md px-2 py-1 hover:bg-slate-100">
            Conversions
          </Link>
          <Link href="/app/campaigns" className="rounded-md px-2 py-1 hover:bg-slate-100">
            Campaigns
          </Link>
          <Link href="/app/marketplace" className="rounded-md px-2 py-1 hover:bg-slate-100">
            Marketplace
          </Link>
          <Link href="/app/ai" className="rounded-md px-2 py-1 hover:bg-slate-100">
            AI assistant
          </Link>
          <Link href="/app/credits" className="rounded-md px-2 py-1 hover:bg-slate-100">
            Credits
          </Link>
          <Link href="/app/payouts" className="rounded-md px-2 py-1 hover:bg-slate-100">
            Payouts
          </Link>
          <Link href="/app/settings" className="rounded-md px-2 py-1 hover:bg-slate-100">
            Settings
          </Link>
        </nav>
        <form action={logoutAction} className="mt-6">
          <button className="text-sm text-[var(--muted)] hover:text-[var(--fg)]">
            Log out
          </button>
        </form>
        <p className="mt-auto pt-8 text-xs text-[var(--muted)]">{session.user.email}</p>
      </aside>
      <main className="p-8">{children}</main>
    </div>
  );
}
