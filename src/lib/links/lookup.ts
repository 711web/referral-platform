import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { links, type Link } from '@/db/schema';
import { redis } from '@/lib/redis';

const CACHE_TTL_SECONDS = 3600;
const NEG_CACHE_TTL_SECONDS = 60;
const NEG_SENTINEL = '__none__';

export async function lookupLinkBySlug(slug: string): Promise<Link | null> {
  const cacheKey = `link:${slug}`;
  const cached = await redis.get(cacheKey);
  if (cached === NEG_SENTINEL) return null;
  if (cached) {
    try {
      return JSON.parse(cached) as Link;
    } catch {
      // fall through to DB
    }
  }
  const [row] = await db.select().from(links).where(eq(links.slug, slug)).limit(1);
  if (!row) {
    await redis.set(cacheKey, NEG_SENTINEL, 'EX', NEG_CACHE_TTL_SECONDS);
    return null;
  }
  await redis.set(cacheKey, JSON.stringify(row), 'EX', CACHE_TTL_SECONDS);
  return row;
}
