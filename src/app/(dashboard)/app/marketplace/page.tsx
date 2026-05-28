import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';
import { listLiveCampaigns, listJoinedCampaignsForCreator } from '@/lib/campaigns/queries';
import { rankCampaignsForCreator } from '@/lib/matching/tags';
import { joinCampaignAction } from '../campaigns/actions';

export const dynamic = 'force-dynamic';

export default async function MarketplacePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');

  const [liveRaw, joined] = await Promise.all([
    listLiveCampaigns(),
    listJoinedCampaignsForCreator(ws.id),
  ]);
  const live = rankCampaignsForCreator(ws.tags, liveRaw);
  const joinedIds = new Set(joined.map((j) => j.campaign.id));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Marketplace</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Live brand campaigns. Joining mints you a per-creator tracking link.
        </p>
      </header>

      {live.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">
          No live campaigns yet.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {live.map((c) => {
            const alreadyJoined = joinedIds.has(c.id) || c.brandWorkspaceId === ws.id;
            return (
              <li
                key={c.id}
                className="flex h-full flex-col gap-3 rounded-md border border-[var(--border)] bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {c.brandName}
                    </div>
                    <div className="text-lg font-medium">{c.name}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-md border border-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                      {(c.commissionBps / 100).toFixed(1)}%
                    </span>
                    {c.score > 0 && (
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-mono text-emerald-700">
                        match {Math.round(c.score * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                {c.brief && (
                  <p className="text-sm leading-snug text-[var(--muted)]">{c.brief}</p>
                )}
                {c.tags && (
                  <div className="flex flex-wrap gap-1 text-[11px] font-mono">
                    {c.tags.split(',').map((tag, i) => {
                      const t = tag.trim();
                      if (!t) return null;
                      return (
                        <span
                          key={i}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[var(--muted)]"
                        >
                          #{t}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="mt-auto pt-2">
                  {alreadyJoined ? (
                    <Link
                      href="/app/campaigns"
                      className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline"
                    >
                      Joined → view link
                    </Link>
                  ) : (
                    <form action={joinCampaignAction}>
                      <input type="hidden" name="campaignId" value={c.id} />
                      <button
                        type="submit"
                        className="cursor-pointer rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
                      >
                        Join campaign
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
