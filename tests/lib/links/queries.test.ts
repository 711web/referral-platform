import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/db/client';
import { links, workspaces, users } from '@/db/schema';
import {
  listLinksForWorkspace,
  createLinkForWorkspace,
  updateLinkInWorkspace,
  deleteLinkInWorkspace,
} from '@/lib/links/queries';

const UID_A = 'test-queries-a';
const UID_B = 'test-queries-b';
let wsA: string;
let wsB: string;

describe('link queries (workspace-scoped)', () => {
  beforeAll(async () => {
    await db.delete(users).where(eq(users.id, UID_A));
    await db.delete(users).where(eq(users.id, UID_B));
    await db.insert(users).values([
      { id: UID_A, email: 'a@example.com' },
      { id: UID_B, email: 'b@example.com' },
    ]);
    const [a] = await db.insert(workspaces).values({ ownerUserId: UID_A, name: 'A' }).returning();
    const [b] = await db.insert(workspaces).values({ ownerUserId: UID_B, name: 'B' }).returning();
    wsA = a!.id;
    wsB = b!.id;
  });

  beforeEach(async () => {
    await db.delete(links).where(eq(links.workspaceId, wsA));
    await db.delete(links).where(eq(links.workspaceId, wsB));
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, UID_A));
    await db.delete(users).where(eq(users.id, UID_B));
    await pool.end();
  });

  it('createLinkForWorkspace inserts under the given workspace', async () => {
    const row = await createLinkForWorkspace(wsA, {
      slug: 'wq-1',
      destinationUrl: 'https://example.com/1',
    });
    expect(row.workspaceId).toBe(wsA);
  });

  it("listLinksForWorkspace returns only that workspace's links with click counts", async () => {
    await createLinkForWorkspace(wsA, { slug: 'wq-a', destinationUrl: 'https://a' });
    await createLinkForWorkspace(wsB, { slug: 'wq-b', destinationUrl: 'https://b' });
    const aLinks = await listLinksForWorkspace(wsA);
    expect(aLinks.map((l) => l.slug)).toEqual(['wq-a']);
    expect(aLinks[0]!.clickCount).toBe(0);
  });

  it('updateLinkInWorkspace updates only when both id + workspaceId match', async () => {
    const a = await createLinkForWorkspace(wsA, { slug: 'wq-up', destinationUrl: 'https://old' });
    const updated = await updateLinkInWorkspace(a.id, wsA, { destinationUrl: 'https://new' });
    expect(updated?.destinationUrl).toBe('https://new');
    const crossTenant = await updateLinkInWorkspace(a.id, wsB, { destinationUrl: 'https://hack' });
    expect(crossTenant).toBeNull();
  });

  it('deleteLinkInWorkspace only deletes when workspaceId matches', async () => {
    const a = await createLinkForWorkspace(wsA, { slug: 'wq-del', destinationUrl: 'https://x' });
    const wrongDelete = await deleteLinkInWorkspace(a.id, wsB);
    expect(wrongDelete).toBe(false);
    const rightDelete = await deleteLinkInWorkspace(a.id, wsA);
    expect(rightDelete).toBe(true);
  });

  it('createLinkForWorkspace rejects duplicate slug across all workspaces', async () => {
    await createLinkForWorkspace(wsA, { slug: 'wq-dup', destinationUrl: 'https://a' });
    await expect(
      createLinkForWorkspace(wsB, { slug: 'wq-dup', destinationUrl: 'https://b' }),
    ).rejects.toThrow();
  });
});
