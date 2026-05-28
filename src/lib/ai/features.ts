import { aiAvailable, callOpenRouter } from './openrouter';
import { chargeCredits, getCredits } from '@/lib/credits/queries';

export type AiOutcome =
  | { ok: true; text: string; creditsRemaining: number }
  | { ok: false; error: string; status: number; creditsRemaining: number };

const COST_BRIEF = 2;
const COST_POST_COPY = 1;
const COST_PITCH = 1;

async function runAi(
  workspaceId: string,
  feature: string,
  cost: number,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 600,
): Promise<AiOutcome> {
  const balance = await getCredits(workspaceId);
  if (!aiAvailable()) {
    return {
      ok: false,
      error: 'AI features are not yet enabled (missing OPENROUTER_API_KEY)',
      status: 503,
      creditsRemaining: balance,
    };
  }
  const charge = await chargeCredits(workspaceId, cost, {
    feature,
    model: 'anthropic/claude-haiku-4.5',
  });
  if (!charge.ok) {
    return {
      ok: false,
      error: `not enough credits (need ${cost}, have ${charge.remaining})`,
      status: 402,
      creditsRemaining: charge.remaining,
    };
  }
  try {
    const out = await callOpenRouter(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens },
    );
    return { ok: true, text: out.text.trim(), creditsRemaining: charge.remaining };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI provider failed';
    return {
      ok: false,
      error: msg,
      status: 502,
      creditsRemaining: charge.remaining,
    };
  }
}

export function generateCampaignBrief(
  workspaceId: string,
  args: { campaignName: string; landingUrl: string; tags?: string },
): Promise<AiOutcome> {
  return runAi(
    workspaceId,
    'campaign_brief',
    COST_BRIEF,
    `You are a senior creator-economy strategist. Output a concise campaign brief for influencers/affiliates. Sections: Pitch (1 sentence), Audience (bullet list), Talking points (bullet list), Hashtags (5).`,
    `Campaign: ${args.campaignName}
Landing URL: ${args.landingUrl}
Tags: ${args.tags ?? '(none)'}`,
    700,
  );
}

export function generatePostCopy(
  workspaceId: string,
  args: { platform: 'instagram' | 'tiktok' | 'x' | 'youtube'; campaignName: string; brief?: string },
): Promise<AiOutcome> {
  return runAi(
    workspaceId,
    `post_copy_${args.platform}`,
    COST_POST_COPY,
    `You write platform-native creator captions. Match the voice of the platform. Output ONLY the caption text, no preamble. Include 3-6 relevant hashtags at the end.`,
    `Platform: ${args.platform}
Campaign: ${args.campaignName}
Brief: ${args.brief ?? '(none)'}

Write a caption I (a small-to-mid creator) could post.`,
    400,
  );
}

export function generatePitchMessage(
  workspaceId: string,
  args: { creatorHandle: string; campaignName: string; brief?: string },
): Promise<AiOutcome> {
  return runAi(
    workspaceId,
    'pitch_dm',
    COST_PITCH,
    `You are a brand partnerships lead. Write a short, warm DM (4 sentences max) inviting a creator to a campaign. No fake compliments.`,
    `Creator: @${args.creatorHandle}
Campaign: ${args.campaignName}
Brief: ${args.brief ?? '(none)'}`,
    300,
  );
}
