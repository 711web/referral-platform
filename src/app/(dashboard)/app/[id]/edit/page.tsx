import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { workspaces } from '@/db/schema';
import { getSession } from '@/lib/auth/session';
import { getLinkByIdInWorkspace } from '@/lib/links/queries';
import { EditLinkForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, session.user.id))
    .limit(1);
  if (!ws) redirect('/login');
  const link = await getLinkByIdInWorkspace(id, ws.id);
  if (!link) notFound();

  return (
    <div className="mx-auto max-w-md">
      <Link href="/app" className="mb-4 inline-block text-sm text-[var(--muted)]">
        ← Back
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">Edit link</h1>
      <EditLinkForm id={link.id} slug={link.slug} destinationUrl={link.destinationUrl} />
    </div>
  );
}
