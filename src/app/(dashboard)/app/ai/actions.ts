'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';
import {
  generateCampaignBrief,
  generatePostCopy,
  generatePitchMessage,
  type AiOutcome,
} from '@/lib/ai/features';

export type AiResultState = {
  text?: string;
  error?: string;
  creditsRemaining?: number;
};

function toState(o: AiOutcome): AiResultState {
  if (o.ok) return { text: o.text, creditsRemaining: o.creditsRemaining };
  return { error: o.error, creditsRemaining: o.creditsRemaining };
}

export async function generateBriefAction(
  _prev: AiResultState,
  formData: FormData,
): Promise<AiResultState> {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');
  const name = String(formData.get('campaignName') ?? '').trim();
  const landingUrl = String(formData.get('landingUrl') ?? '').trim();
  const tags = String(formData.get('tags') ?? '').trim();
  if (!name || !landingUrl) return { error: 'name + landing URL required' };
  return toState(await generateCampaignBrief(ws.id, { campaignName: name, landingUrl, tags }));
}

export async function generatePostCopyAction(
  _prev: AiResultState,
  formData: FormData,
): Promise<AiResultState> {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');
  const platform = String(formData.get('platform') ?? 'instagram') as
    | 'instagram'
    | 'tiktok'
    | 'x'
    | 'youtube';
  const campaignName = String(formData.get('campaignName') ?? '').trim();
  const brief = String(formData.get('brief') ?? '').trim();
  if (!campaignName) return { error: 'campaign name required' };
  return toState(await generatePostCopy(ws.id, { platform, campaignName, brief }));
}

export async function generatePitchAction(
  _prev: AiResultState,
  formData: FormData,
): Promise<AiResultState> {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');
  const creatorHandle = String(formData.get('creatorHandle') ?? '').trim();
  const campaignName = String(formData.get('campaignName') ?? '').trim();
  const brief = String(formData.get('brief') ?? '').trim();
  if (!creatorHandle || !campaignName) return { error: 'creator + campaign required' };
  return toState(await generatePitchMessage(ws.id, { creatorHandle, campaignName, brief }));
}
