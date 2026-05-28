'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';
import { createCampaign, updateCampaign, joinCampaignAsCreator } from '@/lib/campaigns/queries';

export type CampaignFormState = { error?: string };

function parseCommissionPct(input: string): number | null {
  const n = parseFloat(input);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100); // % → bps
}

export async function createCampaignAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');

  const name = String(formData.get('name') ?? '').trim();
  const brief = String(formData.get('brief') ?? '').trim();
  const landingUrl = String(formData.get('landingUrl') ?? '').trim();
  const commissionStr = String(formData.get('commissionPct') ?? '').trim();
  const tags = String(formData.get('tags') ?? '').trim();
  const status = (formData.get('status') === 'live' ? 'live' : 'draft') as 'live' | 'draft';

  if (!name || !landingUrl) return { error: 'name and landing URL required' };
  try {
    new URL(landingUrl);
  } catch {
    return { error: 'landing URL must be a valid absolute URL' };
  }
  const commissionBps = parseCommissionPct(commissionStr);
  if (commissionBps === null) return { error: 'commission must be a percentage 0–100' };

  await createCampaign(ws.id, { name, brief, landingUrl, commissionBps, tags, status });
  revalidatePath('/app/campaigns');
  redirect('/app/campaigns');
}

export async function updateCampaignAction(
  _prev: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');

  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'missing id' };
  const name = String(formData.get('name') ?? '').trim();
  const brief = String(formData.get('brief') ?? '').trim();
  const landingUrl = String(formData.get('landingUrl') ?? '').trim();
  const commissionStr = String(formData.get('commissionPct') ?? '').trim();
  const tags = String(formData.get('tags') ?? '').trim();
  const status = String(formData.get('status') ?? 'draft') as
    | 'draft'
    | 'live'
    | 'paused'
    | 'ended';

  if (!name || !landingUrl) return { error: 'name and landing URL required' };
  try {
    new URL(landingUrl);
  } catch {
    return { error: 'landing URL must be a valid absolute URL' };
  }
  const commissionBps = parseCommissionPct(commissionStr);
  if (commissionBps === null) return { error: 'commission must be a percentage 0–100' };

  const row = await updateCampaign(id, ws.id, {
    name,
    brief,
    landingUrl,
    commissionBps,
    tags,
    status,
  });
  if (!row) return { error: 'not found' };
  revalidatePath('/app/campaigns');
  redirect('/app/campaigns');
}

export async function joinCampaignAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');
  const campaignId = String(formData.get('campaignId') ?? '');
  if (!campaignId) redirect('/app/marketplace');
  await joinCampaignAsCreator(campaignId, ws.id);
  revalidatePath('/app/marketplace');
  redirect('/app/marketplace');
}
