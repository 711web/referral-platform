import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { ulid } from 'ulid';
import {
  campaigns,
  campaignCreators,
  links,
  clicks,
  conversions,
  commissions,
  workspaces,
  type Campaign,
} from '@/db/schema';

export type CampaignWithStats = Campaign & {
  creators: number;
  clicks: number;
  conversions: number;
  totalAmountCents: number;
  totalCommissionCents: number;
};

export async function listCampaignsForBrand(
  brandWorkspaceId: string,
): Promise<CampaignWithStats[]> {
  const rows = await db
    .select({
      campaign: campaigns,
      creators: sql<number>`coalesce((SELECT count(*)::int FROM campaign_creators cc WHERE cc.campaign_id = ${campaigns.id} AND cc.status = 'joined'), 0)`,
      clicks: sql<number>`coalesce((SELECT count(*)::int FROM clicks ck JOIN links l ON l.id = ck.link_id WHERE l.campaign_id = ${campaigns.id}), 0)`,
      conversions: sql<number>`coalesce((SELECT count(*)::int FROM conversions cv WHERE cv.brand_workspace_id = ${brandWorkspaceId} AND cv.link_id IN (SELECT id FROM links WHERE campaign_id = ${campaigns.id})), 0)`,
      totalAmountCents: sql<number>`coalesce((SELECT sum(amount_cents)::int FROM conversions cv WHERE cv.brand_workspace_id = ${brandWorkspaceId} AND cv.link_id IN (SELECT id FROM links WHERE campaign_id = ${campaigns.id})), 0)`,
      totalCommissionCents: sql<number>`coalesce((SELECT sum(amount_cents)::int FROM commissions co WHERE co.brand_workspace_id = ${brandWorkspaceId} AND co.conversion_id IN (SELECT id FROM conversions WHERE link_id IN (SELECT id FROM links WHERE campaign_id = ${campaigns.id}))), 0)`,
    })
    .from(campaigns)
    .where(eq(campaigns.brandWorkspaceId, brandWorkspaceId))
    .orderBy(desc(campaigns.createdAt));
  return rows.map((r) => ({ ...r.campaign, ...r }) as unknown as CampaignWithStats);
}

export async function createCampaign(
  brandWorkspaceId: string,
  input: {
    name: string;
    brief: string;
    landingUrl: string;
    commissionBps: number;
    tags?: string;
    status?: 'draft' | 'live';
  },
): Promise<Campaign> {
  const [row] = await db
    .insert(campaigns)
    .values({
      brandWorkspaceId,
      name: input.name,
      brief: input.brief,
      landingUrl: input.landingUrl,
      commissionBps: input.commissionBps,
      tags: input.tags ?? '',
      status: input.status ?? 'draft',
    })
    .returning();
  return row!;
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row ?? null;
}

export async function updateCampaign(
  id: string,
  brandWorkspaceId: string,
  patch: Partial<Pick<Campaign, 'name' | 'brief' | 'landingUrl' | 'commissionBps' | 'status' | 'tags'>>,
): Promise<Campaign | null> {
  const [row] = await db
    .update(campaigns)
    .set(patch)
    .where(and(eq(campaigns.id, id), eq(campaigns.brandWorkspaceId, brandWorkspaceId)))
    .returning();
  return row ?? null;
}

export async function listLiveCampaigns(limit = 50): Promise<
  Array<Campaign & { brandName: string }>
> {
  const rows = await db
    .select({ camp: campaigns, brandName: workspaces.name })
    .from(campaigns)
    .innerJoin(workspaces, eq(workspaces.id, campaigns.brandWorkspaceId))
    .where(eq(campaigns.status, 'live'))
    .orderBy(desc(campaigns.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.camp, brandName: r.brandName }));
}

export async function listJoinedCampaignsForCreator(
  creatorWorkspaceId: string,
): Promise<
  Array<{
    campaign: Campaign;
    join: typeof campaignCreators.$inferSelect;
    trackingSlug: string | null;
  }>
> {
  const rows = await db
    .select({
      campaign: campaigns,
      join: campaignCreators,
      trackingSlug: links.slug,
    })
    .from(campaignCreators)
    .innerJoin(campaigns, eq(campaigns.id, campaignCreators.campaignId))
    .leftJoin(links, eq(links.id, campaignCreators.trackingLinkId))
    .where(
      and(
        eq(campaignCreators.creatorWorkspaceId, creatorWorkspaceId),
        eq(campaignCreators.status, 'joined'),
      ),
    );
  return rows;
}

function shortSlug(prefix = '') {
  // 8-char ULID suffix, lowercased — friendly enough for short URLs
  return (prefix + ulid().slice(-8)).toLowerCase();
}

export async function joinCampaignAsCreator(
  campaignId: string,
  creatorWorkspaceId: string,
): Promise<{ trackingSlug: string }> {
  // Idempotent: if already joined, return existing tracking slug
  const [existing] = await db
    .select({ join: campaignCreators, slug: links.slug })
    .from(campaignCreators)
    .leftJoin(links, eq(links.id, campaignCreators.trackingLinkId))
    .where(
      and(
        eq(campaignCreators.campaignId, campaignId),
        eq(campaignCreators.creatorWorkspaceId, creatorWorkspaceId),
      ),
    )
    .limit(1);
  if (existing && existing.slug) {
    return { trackingSlug: existing.slug };
  }

  const camp = await getCampaignById(campaignId);
  if (!camp) throw new Error('campaign not found');

  // Mint a per-creator tracking link
  const slug = shortSlug('c-');
  const [link] = await db
    .insert(links)
    .values({
      slug,
      destinationUrl: camp.landingUrl,
      workspaceId: creatorWorkspaceId,
      campaignId: camp.id,
    })
    .returning();
  await db
    .insert(campaignCreators)
    .values({
      campaignId,
      creatorWorkspaceId,
      trackingLinkId: link!.id,
      status: 'joined',
    })
    .onConflictDoUpdate({
      target: [campaignCreators.campaignId, campaignCreators.creatorWorkspaceId],
      set: { trackingLinkId: link!.id, status: 'joined' },
    });
  return { trackingSlug: link!.slug };
}
