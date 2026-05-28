import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { workspaces, type Workspace } from '@/db/schema';

export async function getWorkspaceForUser(userId: string): Promise<Workspace | null> {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId))
    .limit(1);
  return ws ?? null;
}

export async function setBrandCredentials(
  workspaceId: string,
  brandKey: string,
  brandSecret: string,
): Promise<Workspace | null> {
  const [row] = await db
    .update(workspaces)
    .set({ brandKey, brandSecret, kind: 'brand' })
    .where(eq(workspaces.id, workspaceId))
    .returning();
  return row ?? null;
}
