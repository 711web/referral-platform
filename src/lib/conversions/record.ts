import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  clicks,
  links,
  campaigns,
  conversions,
  commissions,
  type Conversion,
  type Commission,
} from '@/db/schema';

// Default commission rate when no campaign-level rate is set.
const DEFAULT_COMMISSION_BPS = 1000; // 10.00% expressed in basis points

export type RecordConversionInput = {
  clickIdCookie: string;
  brandWorkspaceId: string;
  amountCents: number;
  currency?: string;
  externalOrderId: string | null;
  source: 'webhook' | 'pixel';
  /** Override commission rate (basis points). Used by campaigns in Slice 4. */
  commissionBps?: number;
};

export type RecordConversionResult = {
  conversion: Conversion;
  commission: Commission | null;
  duplicate: boolean;
};

export async function recordConversion(
  input: RecordConversionInput,
): Promise<RecordConversionResult> {
  const currency = input.currency ?? 'USD';
  const commissionBps = input.commissionBps ?? DEFAULT_COMMISSION_BPS;

  // 1. Look up the click to find the link + creator workspace
  const [click] = await db
    .select()
    .from(clicks)
    .where(eq(clicks.clickIdCookie, input.clickIdCookie))
    .limit(1);

  let linkId: string | null = null;
  let creatorWorkspaceId: string | null = null;
  let resolvedCommissionBps = commissionBps;

  if (click) {
    linkId = click.linkId;
    const [link] = await db
      .select({
        id: links.id,
        workspaceId: links.workspaceId,
        campaignId: links.campaignId,
      })
      .from(links)
      .where(eq(links.id, click.linkId))
      .limit(1);
    if (link) {
      creatorWorkspaceId = link.workspaceId;
      // If link is part of a campaign, use the campaign's commission rate
      if (link.campaignId && input.commissionBps === undefined) {
        const [camp] = await db
          .select({ commissionBps: campaigns.commissionBps })
          .from(campaigns)
          .where(eq(campaigns.id, link.campaignId))
          .limit(1);
        if (camp) resolvedCommissionBps = camp.commissionBps;
      }
    }
  }

  // 2. Idempotency check
  if (input.externalOrderId) {
    const [existing] = await db
      .select()
      .from(conversions)
      .where(
        and(
          eq(conversions.brandWorkspaceId, input.brandWorkspaceId),
          eq(conversions.externalOrderId, input.externalOrderId),
        ),
      )
      .limit(1);
    if (existing) {
      const [existingCommission] = await db
        .select()
        .from(commissions)
        .where(eq(commissions.conversionId, existing.id))
        .limit(1);
      return {
        conversion: existing,
        commission: existingCommission ?? null,
        duplicate: true,
      };
    }
  }

  // 3. Insert conversion + commission atomically
  const [conv] = await db
    .insert(conversions)
    .values({
      clickIdCookie: input.clickIdCookie,
      linkId,
      creatorWorkspaceId,
      brandWorkspaceId: input.brandWorkspaceId,
      amountCents: input.amountCents,
      currency,
      externalOrderId: input.externalOrderId,
      source: input.source,
      status: 'pending',
    })
    .returning();

  let commission: Commission | null = null;
  if (creatorWorkspaceId && input.amountCents > 0) {
    const commissionCents = Math.floor((input.amountCents * resolvedCommissionBps) / 10000);
    const [com] = await db
      .insert(commissions)
      .values({
        conversionId: conv!.id,
        creatorWorkspaceId,
        brandWorkspaceId: input.brandWorkspaceId,
        amountCents: commissionCents,
        currency,
        status: 'accrued',
      })
      .returning();
    commission = com ?? null;
  }

  return { conversion: conv!, commission, duplicate: false };
}
