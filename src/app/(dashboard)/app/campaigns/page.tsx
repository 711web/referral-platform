import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';
import { listCampaignsForBrand, listJoinedCampaignsForCreator } from '@/lib/campaigns/queries';

export const dynamic = 'force-dynamic';

function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export default async function CampaignsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');

  const brand = await listCampaignsForBrand(ws.id);
  const joined = await listJoinedCampaignsForCreator(ws.id);
  const shortDomain = process.env.SHORT_DOMAIN ?? 'partner.711web.com';

  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <section>
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your campaigns</h1>
          <Link
            href="/app/campaigns/new"
            className="cursor-pointer rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
          >
            New campaign
          </Link>
        </header>
        {brand.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">
            You haven&apos;t created any campaigns yet.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-md border border-[var(--border)] bg-white">
            {brand.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-[var(--border)] p-4 last:border-b-0"
              >
                <div>
                  <Link
                    href={`/app/campaigns/${c.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span
                    className={`ml-3 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                      c.status === 'live'
                        ? 'border-emerald-300 text-emerald-700'
                        : 'border-slate-300 text-slate-500'
                    }`}
                  >
                    {c.status}
                  </span>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {(c.commissionBps / 100).toFixed(1)}% · {c.creators} creator
                    {c.creators === 1 ? '' : 's'} · {c.clicks} click
                    {c.clicks === 1 ? '' : 's'} · {c.conversions} conv ·{' '}
                    {money(c.totalAmountCents, c.currency)} ·{' '}
                    {money(c.totalCommissionCents, c.currency)} paid out
                  </div>
                </div>
                <Link
                  href={`/app/campaigns/${c.id}`}
                  className="cursor-pointer text-xs text-[var(--muted)] underline-offset-4 hover:underline"
                >
                  edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Campaigns you joined</h2>
        {joined.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">
            Nothing joined yet — browse{' '}
            <Link className="underline" href="/app/marketplace">
              marketplace
            </Link>
            .
          </p>
        ) : (
          <ul className="overflow-hidden rounded-md border border-[var(--border)] bg-white">
            {joined.map(({ campaign, trackingSlug }) => (
              <li key={campaign.id} className="border-b border-[var(--border)] p-4 last:border-b-0">
                <div className="font-medium">{campaign.name}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {(campaign.commissionBps / 100).toFixed(1)}% commission
                </div>
                <div className="mt-2 break-all font-mono text-[12.5px]">
                  https://{shortDomain}/go/{trackingSlug ?? '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
