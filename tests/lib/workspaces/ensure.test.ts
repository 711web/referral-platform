import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/db/client';
import { users, workspaces } from '@/db/schema';
import { ensureWorkspaceForUser } from '@/lib/workspaces/ensure';

const TEST_USER_ID = 'test-ensure-user';

describe('ensureWorkspaceForUser', () => {
  beforeAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.ownerUserId, TEST_USER_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
    await db.insert(users).values({ id: TEST_USER_ID, email: 'ensure-test@example.com' });
  });

  beforeEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.ownerUserId, TEST_USER_ID));
  });

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.ownerUserId, TEST_USER_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
    await pool.end();
  });

  it('creates a workspace on first call', async () => {
    const ws = await ensureWorkspaceForUser(TEST_USER_ID, 'ensure-test@example.com');
    expect(ws.ownerUserId).toBe(TEST_USER_ID);
    expect(ws.kind).toBe('creator');
    expect(ws.name).toBe('ensure-test');
  });

  it('returns the existing workspace on subsequent calls (idempotent)', async () => {
    const ws1 = await ensureWorkspaceForUser(TEST_USER_ID, 'ensure-test@example.com');
    const ws2 = await ensureWorkspaceForUser(TEST_USER_ID, 'ensure-test@example.com');
    expect(ws2.id).toBe(ws1.id);
    const rows = await db.select().from(workspaces).where(eq(workspaces.ownerUserId, TEST_USER_ID));
    expect(rows.length).toBe(1);
  });
});
