import { redirect } from 'next/navigation';
import { desc, eq, or } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { conversions, commissions } from '@/db/schema';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';

export const dynamic = 'force-dynamic';

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    cents / 100,
  );
}

export default async function ConversionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');

  // Workspace sees conversions where it's EITHER the brand OR the creator
  const rows = await db
    .select({
      conv: conversions,
      commission: commissions,
    })
    .from(conversions)
    .leftJoin(commissions, eq(commissions.conversionId, conversions.id))
    .where(
      or(
        eq(conversions.brandWorkspaceId, ws.id),
        eq(conversions.creatorWorkspaceId, ws.id),
      ),
    )
    .orderBy(desc(conversions.ts))
    .limit(100);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link
          href="/app"
          className="text-sm text-[var(--muted)] underline-offset-4 hover:underline"
        >
          ← back
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Conversions</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Latest 100 conversions across this workspace (as brand and as creator).
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">
          No conversions yet. Set up brand credentials in{' '}
          <Link className="underline" href="/app/settings">
            settings
          </Link>{' '}
          and send a test event.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ conv, commission }) => (
                <tr key={conv.id} className="border-t border-[var(--border)]">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px]">
                    {new Date(conv.ts).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="px-4 py-3">{conv.source}</td>
                  <td className="px-4 py-3 font-mono tnum">
                    {money(conv.amountCents, conv.currency)}
                  </td>
                  <td className="px-4 py-3 font-mono tnum">
                    {commission
                      ? money(commission.amountCents, commission.currency)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[var(--muted)]">
                    {conv.externalOrderId ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                        conv.status === 'approved'
                          ? 'border-emerald-300 text-emerald-700'
                          : conv.status === 'reversed'
                            ? 'border-red-300 text-red-700'
                            : 'border-amber-300 text-amber-700'
                      }`}
                    >
                      {conv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
