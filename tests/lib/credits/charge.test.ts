import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/db/client';
import { users, workspaces, aiUsage, creditPacks } from '@/db/schema';
import { chargeCredits, grantCredits, getCredits } from '@/lib/credits/queries';

const UID = 'test-credits-user';
let ws: string;

describe('credits', () => {
  beforeAll(async () => {
    await db.delete(users).where(eq(users.id, UID));
    await db.insert(users).values({ id: UID, email: 'creds@example.com' });
    const [w] = await db
      .insert(workspaces)
      .values({ ownerUserId: UID, name: 'Creds' })
      .returning();
    ws = w!.id;
  });

  beforeEach(async () => {
    await db.delete(aiUsage).where(eq(aiUsage.workspaceId, ws));
    await db.delete(creditPacks).where(eq(creditPacks.workspaceId, ws));
    await db.update(workspaces).set({ aiCredits: 0 }).where(eq(workspaces.id, ws));
  });

  afterAll(async () => {
    await db.delete(aiUsage).where(eq(aiUsage.workspaceId, ws));
    await db.delete(creditPacks).where(eq(creditPacks.workspaceId, ws));
    await db.delete(workspaces).where(eq(workspaces.ownerUserId, UID));
    await db.delete(users).where(eq(users.id, UID));
    await pool.end();
  });

  it('refuses to charge when balance is insufficient', async () => {
    const r = await chargeCredits(ws, 1, {
      feature: 'caption',
      model: 'haiku',
    });
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
    const usage = await db
      .select()
      .from(aiUsage)
      .where(eq(aiUsage.workspaceId, ws));
    expect(usage.length).toBe(0);
  });

  it('grants credits and then charges them down', async () => {
    await grantCredits(ws, 10, {
      amountCents: 500,
      stripeSessionId: 'cs_test_xyz',
    });
    expect(await getCredits(ws)).toBe(10);

    const a = await chargeCredits(ws, 3, { feature: 'brief', model: 'haiku' });
    expect(a.ok).toBe(true);
    expect(a.remaining).toBe(7);

    const b = await chargeCredits(ws, 5, { feature: 'caption', model: 'haiku' });
    expect(b.ok).toBe(true);
    expect(b.remaining).toBe(2);

    const c = await chargeCredits(ws, 3, { feature: 'caption', model: 'haiku' });
    expect(c.ok).toBe(false);
    expect(c.remaining).toBe(2);

    const usage = await db
      .select()
      .from(aiUsage)
      .where(eq(aiUsage.workspaceId, ws));
    expect(usage.length).toBe(2);
  });

  it('grantCredits is idempotent through unique stripe_session_id (DB-level)', async () => {
    await grantCredits(ws, 100, {
      amountCents: 1000,
      stripeSessionId: 'cs_dup',
    });
    await expect(
      grantCredits(ws, 100, {
        amountCents: 1000,
        stripeSessionId: 'cs_dup',
      }),
    ).rejects.toThrow();
    expect(await getCredits(ws)).toBe(100);
  });
});
