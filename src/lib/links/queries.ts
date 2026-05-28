import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { links, clicks, type Link } from '@/db/schema';

export type LinkWithClicks = Link & { clickCount: number };

export async function listLinksForWorkspace(workspaceId: string): Promise<LinkWithClicks[]> {
  const rows = await db
    .select({
      id: links.id,
      slug: links.slug,
      destinationUrl: links.destinationUrl,
      workspaceId: links.workspaceId,
      campaignId: links.campaignId,
      createdAt: links.createdAt,
      clickCount: sql<number>`coalesce(count(${clicks.id}), 0)::int`,
    })
    .from(links)
    .leftJoin(clicks, eq(clicks.linkId, links.id))
    .where(eq(links.workspaceId, workspaceId))
    .groupBy(links.id)
    .orderBy(desc(links.createdAt));
  return rows;
}

export async function createLinkForWorkspace(
  workspaceId: string,
  input: { slug: string; destinationUrl: string },
): Promise<Link> {
  const [row] = await db
    .insert(links)
    .values({ workspaceId, slug: input.slug, destinationUrl: input.destinationUrl })
    .returning();
  return row!;
}

export async function getLinkByIdInWorkspace(
  id: string,
  workspaceId: string,
): Promise<Link | null> {
  const [row] = await db
    .select()
    .from(links)
    .where(and(eq(links.id, id), eq(links.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function updateLinkInWorkspace(
  id: string,
  workspaceId: string,
  input: { destinationUrl?: string; slug?: string },
): Promise<Link | null> {
  if (input.destinationUrl === undefined && input.slug === undefined) {
    return getLinkByIdInWorkspace(id, workspaceId);
  }
  const [row] = await db
    .update(links)
    .set({
      ...(input.destinationUrl !== undefined && { destinationUrl: input.destinationUrl }),
      ...(input.slug !== undefined && { slug: input.slug }),
    })
    .where(and(eq(links.id, id), eq(links.workspaceId, workspaceId)))
    .returning();
  return row ?? null;
}

export async function deleteLinkInWorkspace(
  id: string,
  workspaceId: string,
): Promise<boolean> {
  const rows = await db
    .delete(links)
    .where(and(eq(links.id, id), eq(links.workspaceId, workspaceId)))
    .returning({ id: links.id });
  return rows.length > 0;
}
