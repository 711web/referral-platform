import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '@/db/client';
import {
  users,
  workspaces,
  links,
  clicks,
  conversions,
  commissions,
} from '@/db/schema';
import { recordConversion } from '@/lib/conversions/record';

const UID_BRAND = 'test-conv-brand';
const UID_CREATOR = 'test-conv-creator';
let brandWs: string;
let creatorWs: string;
let linkId: string;
let clickIdCookie = 'CLK_TEST_CONV_001';

describe('recordConversion', () => {
  beforeAll(async () => {
    await db.execute(sql`DELETE FROM users WHERE id IN ('${sql.raw(UID_BRAND)}', '${sql.raw(UID_CREATOR)}')`);
    await db.insert(users).values([
      { id: UID_BRAND, email: 'brand@example.com' },
      { id: UID_CREATOR, email: 'creator@example.com' },
    ]);
    const [b] = await db
      .insert(workspaces)
      .values({ ownerUserId: UID_BRAND, name: 'BrandCo', kind: 'brand' })
      .returning();
    const [c] = await db
      .insert(workspaces)
      .values({ ownerUserId: UID_CREATOR, name: 'CreatorBob', kind: 'creator' })
      .returning();
    brandWs = b!.id;
    creatorWs = c!.id;

    const [l] = await db
      .insert(links)
      .values({
        slug: 'conv-test-link',
        destinationUrl: 'https://brand.example.com/sale',
        workspaceId: creatorWs,
      })
      .returning();
    linkId = l!.id;

    await db.insert(clicks).values({
      linkId,
      clickIdCookie,
      userAgent: 'test',
    });
  });

  beforeEach(async () => {
    await db.delete(commissions).where(eq(commissions.brandWorkspaceId, brandWs));
    await db.delete(conversions).where(eq(conversions.brandWorkspaceId, brandWs));
  });

  afterAll(async () => {
    await db.delete(commissions).where(eq(commissions.brandWorkspaceId, brandWs));
    await db.delete(conversions).where(eq(conversions.brandWorkspaceId, brandWs));
    await db.delete(clicks).where(eq(clicks.linkId, linkId));
    await db.delete(links).where(eq(links.id, linkId));
    await db.delete(workspaces).where(eq(workspaces.ownerUserId, UID_BRAND));
    await db.delete(workspaces).where(eq(workspaces.ownerUserId, UID_CREATOR));
    await db.delete(users).where(eq(users.id, UID_BRAND));
    await db.delete(users).where(eq(users.id, UID_CREATOR));
    await pool.end();
  });

  it('records a conversion and accrues a commission to the link owner', async () => {
    const res = await recordConversion({
      clickIdCookie,
      brandWorkspaceId: brandWs,
      amountCents: 4900,
      currency: 'USD',
      externalOrderId: 'ord_123',
      source: 'webhook',
    });
    expect(res.conversion.clickIdCookie).toBe(clickIdCookie);
    expect(res.conversion.creatorWorkspaceId).toBe(creatorWs);
    expect(res.conversion.linkId).toBe(linkId);
    expect(res.commission).not.toBeNull();
    expect(res.commission!.amountCents).toBe(490); // default 10%
    expect(res.commission!.creatorWorkspaceId).toBe(creatorWs);
  });

  it('is idempotent on (brand, external_order_id) — second call returns the same row', async () => {
    const a = await recordConversion({
      clickIdCookie,
      brandWorkspaceId: brandWs,
      amountCents: 1000,
      currency: 'USD',
      externalOrderId: 'ord_dup',
      source: 'webhook',
    });
    const b = await recordConversion({
      clickIdCookie,
      brandWorkspaceId: brandWs,
      amountCents: 9999,
      currency: 'USD',
      externalOrderId: 'ord_dup',
      source: 'webhook',
    });
    expect(b.conversion.id).toBe(a.conversion.id);
    expect(b.commission?.id).toBe(a.commission?.id);
    // Original amount preserved (no over-credit)
    expect(b.conversion.amountCents).toBe(1000);
    // Only one row in DB
    const rows = await db
      .select()
      .from(conversions)
      .where(eq(conversions.brandWorkspaceId, brandWs));
    expect(rows.length).toBe(1);
  });

  it('records the conversion even when click_id is unknown (with null creator + no commission)', async () => {
    const res = await recordConversion({
      clickIdCookie: 'CLK_DOES_NOT_EXIST',
      brandWorkspaceId: brandWs,
      amountCents: 2500,
      currency: 'USD',
      externalOrderId: 'ord_unknown',
      source: 'pixel',
    });
    expect(res.conversion.clickIdCookie).toBe('CLK_DOES_NOT_EXIST');
    expect(res.conversion.creatorWorkspaceId).toBeNull();
    expect(res.conversion.linkId).toBeNull();
    expect(res.commission).toBeNull();
  });
});
