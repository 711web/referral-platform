import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';
import { getCampaignById } from '@/lib/campaigns/queries';
import { EditCampaignForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');
  const camp = await getCampaignById(id);
  if (!camp || camp.brandWorkspaceId !== ws.id) notFound();
  return (
    <div className="mx-auto max-w-md">
      <Link
        href="/app/campaigns"
        className="text-sm text-[var(--muted)] underline-offset-4 hover:underline"
      >
        ← back
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Edit campaign</h1>
      <EditCampaignForm
        id={camp.id}
        defaults={{
          name: camp.name,
          landingUrl: camp.landingUrl,
          commissionPct: (camp.commissionBps / 100).toString(),
          tags: camp.tags,
          brief: camp.brief,
          status: camp.status,
        }}
      />
    </div>
  );
}
