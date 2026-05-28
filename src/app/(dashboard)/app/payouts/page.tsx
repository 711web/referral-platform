import { redirect } from 'next/navigation';
import { desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { commissions, conversions, workspaces } from '@/db/schema';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';

export const dynamic = 'force-dynamic';

function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export default async function PayoutsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');

  const [agg] = await db
    .select({
      accrued: sql<number>`coalesce(sum(case when ${commissions.status} = 'accrued' then ${commissions.amountCents} else 0 end)::int, 0)`,
      approved: sql<number>`coalesce(sum(case when ${commissions.status} = 'approved' then ${commissions.amountCents} else 0 end)::int, 0)`,
      paid: sql<number>`coalesce(sum(case when ${commissions.status} = 'paid' then ${commissions.amountCents} else 0 end)::int, 0)`,
    })
    .from(commissions)
    .where(
      or(
        eq(commissions.brandWorkspaceId, ws.id),
        eq(commissions.creatorWorkspaceId, ws.id),
      ),
    );

  const recent = await db
    .select({ commission: commissions, conversion: conversions, creator: workspaces })
    .from(commissions)
    .innerJoin(conversions, eq(conversions.id, commissions.conversionId))
    .innerJoin(workspaces, eq(workspaces.id, commissions.creatorWorkspaceId))
    .where(
      or(
        eq(commissions.brandWorkspaceId, ws.id),
        eq(commissions.creatorWorkspaceId, ws.id),
      ),
    )
    .orderBy(desc(commissions.createdAt))
    .limit(30);

  const accrued = agg?.accrued ?? 0;
  const approved = agg?.approved ?? 0;
  const paid = agg?.paid ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Payouts</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Commissions across this workspace (as brand and as creator).
          </p>
        </div>
        <a
          href="/api/payouts/csv"
          className="cursor-pointer rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
        >
          Download CSV
        </a>
      </header>

      <section className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-md border border-[var(--border)] bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Accrued</div>
          <div className="mt-1 font-mono tnum text-xl">{money(accrued)}</div>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Approved</div>
          <div className="mt-1 font-mono tnum text-xl">{money(approved)}</div>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Paid</div>
          <div className="mt-1 font-mono tnum text-xl">{money(paid)}</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Counterparty</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--muted)]">
                  No commissions yet.
                </td>
              </tr>
            )}
            {recent.map(({ commission, creator }) => (
              <tr key={commission.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-mono text-[12px]">
                  {new Date(commission.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td className="px-4 py-3">
                  {commission.brandWorkspaceId === ws.id ? 'brand' : 'creator'}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{creator.name}</td>
                <td className="px-4 py-3 font-mono tnum">
                  {money(commission.amountCents, commission.currency)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                      commission.status === 'paid'
                        ? 'border-emerald-300 text-emerald-700'
                        : commission.status === 'approved'
                          ? 'border-blue-300 text-blue-700'
                          : commission.status === 'reversed'
                            ? 'border-red-300 text-red-700'
                            : 'border-amber-300 text-amber-700'
                    }`}
                  >
                    {commission.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
