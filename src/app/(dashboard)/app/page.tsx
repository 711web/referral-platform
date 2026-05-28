import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { workspaces } from '@/db/schema';
import { getSession } from '@/lib/auth/session';
import { listLinksForWorkspace } from '@/lib/links/queries';

export const dynamic = 'force-dynamic';

export default async function LinksListPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, session.user.id))
    .limit(1);
  if (!ws) redirect('/login');

  const rows = await listLinksForWorkspace(ws.id);
  const shortDomain = process.env.SHORT_DOMAIN ?? 'partner.711web.com';

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Links</h1>
        <Link
          href="/app/new"
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
        >
          New link
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
          No links yet — create your first one.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)] rounded-md border border-[var(--border)] bg-white">
          {rows.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">
                  https://{shortDomain}/go/{l.slug}
                </div>
                <div className="truncate text-xs text-[var(--muted)]">{l.destinationUrl}</div>
              </div>
              <div className="ml-4 flex items-center gap-4">
                <span className="text-xs text-[var(--muted)]">
                  {l.clickCount} click{l.clickCount === 1 ? '' : 's'}
                </span>
                <Link href={`/app/${l.id}/edit`} className="text-xs underline">
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
