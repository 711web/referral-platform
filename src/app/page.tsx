import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { Landing } from '@/components/marketing/landing-client';

export const revalidate = 30;

type Stats = {
  clicksToday: number;
  totalClicks: number;
  totalLinks: number;
  totalAccounts: number;
};

async function readStats(): Promise<Stats> {
  try {
    const r = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM clicks WHERE ts > now() - interval '24 hours') AS clicks_today,
        (SELECT count(*)::int FROM clicks)                                          AS total_clicks,
        (SELECT count(*)::int FROM links)                                           AS total_links,
        (SELECT count(*)::int FROM users WHERE id <> 'system')                      AS total_accounts
    `);
    const row = (r.rows[0] ?? {}) as Record<string, number>;
    return {
      clicksToday: Number(row.clicks_today ?? 0),
      totalClicks: Number(row.total_clicks ?? 0),
      totalLinks: Number(row.total_links ?? 0),
      totalAccounts: Number(row.total_accounts ?? 0),
    };
  } catch {
    return { clicksToday: 0, totalClicks: 0, totalLinks: 0, totalAccounts: 0 };
  }
}

export default async function HomePage() {
  const stats = await readStats();
  return <Landing stats={stats} today={new Date().toISOString().slice(0, 10)} />;
}
