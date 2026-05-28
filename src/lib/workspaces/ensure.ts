import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { workspaces, type Workspace } from '@/db/schema';

export async function ensureWorkspaceForUser(
  userId: string,
  email: string,
): Promise<Workspace> {
  const [existing] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId))
    .limit(1);
  if (existing) return existing;

  const name = email.split('@')[0] ?? 'workspace';
  const [created] = await db
    .insert(workspaces)
    .values({ ownerUserId: userId, name, kind: 'creator' })
    .returning();
  return created!;
}
