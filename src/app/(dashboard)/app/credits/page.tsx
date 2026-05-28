import { redirect } from 'next/navigation';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { creditPacks, aiUsage } from '@/db/schema';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';
import { getCredits } from '@/lib/credits/queries';
import { CREDIT_PACKS } from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; cancelled?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');
  const sp = await searchParams;

  const balance = await getCredits(ws.id);
  const packs = await db
    .select()
    .from(creditPacks)
    .where(eq(creditPacks.workspaceId, ws.id))
    .orderBy(desc(creditPacks.purchasedAt))
    .limit(20);
  const usage = await db
    .select()
    .from(aiUsage)
    .where(eq(aiUsage.workspaceId, ws.id))
    .orderBy(desc(aiUsage.ts))
    .limit(20);

  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Credits</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Credits power the AI features. 1 credit ≈ $0.05.
        </p>
      </header>

      {sp.ok === '1' && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
          Purchase complete — credits will appear once Stripe confirms (a few seconds).
        </div>
      )}
      {sp.cancelled === '1' && (
        <div className="rounded-md border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
          Purchase cancelled. No charge made.
        </div>
      )}

      <section className="rounded-lg border border-[var(--border)] bg-white p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Balance</h2>
          <span className="font-mono text-3xl tnum">{balance.toLocaleString()}</span>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Buy a pack</h2>
        {!stripeReady && (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Stripe is not yet configured on this deployment — purchase buttons return 503.
            Drop <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> into{' '}
            <code>/srv/referral-platform/.env</code> and reload PM2 to enable.
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {CREDIT_PACKS.map((p) => (
            <form
              key={p.id}
              method="POST"
              action="/api/stripe/checkout"
              className="flex flex-col gap-2 rounded-md border border-[var(--border)] p-4"
            >
              <input type="hidden" name="packId" value={p.id} />
              <div className="font-semibold">{p.name}</div>
              <div className="text-2xl font-bold tnum">{money(p.amountCents)}</div>
              <div className="text-xs text-[var(--muted)]">
                ${(p.amountCents / 100 / p.credits).toFixed(3)} per credit
              </div>
              <button
                type="submit"
                className="mt-2 cursor-pointer rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
              >
                Buy
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        {packs.length === 0 && usage.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No activity yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="py-2">When</th>
                <th className="py-2">Type</th>
                <th className="py-2">Detail</th>
                <th className="py-2 text-right">Credits</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((p) => (
                <tr key={`p-${p.id}`} className="border-t border-[var(--border)]">
                  <td className="py-2 font-mono text-[12px]">
                    {new Date(p.purchasedAt).toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-2 text-emerald-700">topup</td>
                  <td className="py-2 text-[var(--muted)]">{money(p.amountCents, p.currency)}</td>
                  <td className="py-2 text-right font-mono tnum text-emerald-700">+{p.credits}</td>
                </tr>
              ))}
              {usage.map((u) => (
                <tr key={`u-${u.id}`} className="border-t border-[var(--border)]">
                  <td className="py-2 font-mono text-[12px]">
                    {new Date(u.ts).toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-2">{u.feature}</td>
                  <td className="py-2 text-[var(--muted)]">{u.model}</td>
                  <td className="py-2 text-right font-mono tnum text-red-700">−{u.creditCost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-[var(--muted)]">
        Need to use credits? Go to <Link className="underline" href="/app/ai">AI assistant</Link>.
      </p>
    </div>
  );
}
