import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/db/client';
import { links, workspaces } from '@/db/schema';
import { redis } from '@/lib/redis';
import { lookupLinkBySlug } from '@/lib/links/lookup';

describe('lookupLinkBySlug', () => {
  beforeAll(async () => {
    await db.delete(links);
    await redis.flushdb();
    const [systemWs] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, 'system'))
      .limit(1);
    if (!systemWs) throw new Error('system workspace missing — run backfill');
    await db.insert(links).values({
      slug: 'hello',
      destinationUrl: 'https://example.com/landing',
      workspaceId: systemWs.id,
    });
  });

  beforeEach(async () => {
    await redis.del('link:hello');
  });

  afterAll(async () => {
    await db.delete(links);
    await redis.flushdb();
    await redis.quit();
    await pool.end();
  });

  it('returns the link on cache miss and populates Redis', async () => {
    const link = await lookupLinkBySlug('hello');
    expect(link).not.toBeNull();
    expect(link!.destinationUrl).toBe('https://example.com/landing');
    const cached = await redis.get('link:hello');
    expect(cached).not.toBeNull();
  });

  it('returns the link from Redis on cache hit (no PG query)', async () => {
    await lookupLinkBySlug('hello'); // populate cache
    const link = await lookupLinkBySlug('hello');
    expect(link).not.toBeNull();
    expect(link!.slug).toBe('hello');
  });

  it('returns null for unknown slug', async () => {
    const link = await lookupLinkBySlug('does-not-exist');
    expect(link).toBeNull();
  });
});
