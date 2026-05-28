import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db, pool } from '@/db/client';
import { clicks, links } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueClick, flushClicks, _resetQueue } from '@/lib/clicks/queue';

let linkId: string;

describe('clicks queue', () => {
  beforeAll(async () => {
    await db.delete(clicks);
    await db.delete(links);
    const [row] = await db
      .insert(links)
      .values({ slug: 'qtest', destinationUrl: 'https://example.com' })
      .returning();
    linkId = row!.id;
  });

  beforeEach(async () => {
    _resetQueue();
    await db.delete(clicks);
  });

  afterAll(async () => {
    await db.delete(clicks);
    await db.delete(links);
    await pool.end();
  });

  it('flushes a single enqueued click to Postgres', async () => {
    enqueueClick({ linkId, clickIdCookie: 'c1', userAgent: 'ua', referrer: null });
    await flushClicks();
    const rows = await db.select().from(clicks).where(eq(clicks.linkId, linkId));
    expect(rows.length).toBe(1);
    expect(rows[0]!.clickIdCookie).toBe('c1');
  });

  it('batches multiple enqueued clicks in one flush', async () => {
    enqueueClick({ linkId, clickIdCookie: 'a', userAgent: 'ua', referrer: null });
    enqueueClick({ linkId, clickIdCookie: 'b', userAgent: 'ua', referrer: null });
    enqueueClick({ linkId, clickIdCookie: 'c', userAgent: 'ua', referrer: null });
    await flushClicks();
    const rows = await db.select().from(clicks).where(eq(clicks.linkId, linkId));
    expect(rows.length).toBe(3);
  });

  it('does nothing when queue is empty', async () => {
    await expect(flushClicks()).resolves.toBeUndefined();
  });
});
