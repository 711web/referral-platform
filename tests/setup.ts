import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { sql } from 'drizzle-orm';
import { beforeAll } from 'vitest';
import { db } from '@/db/client';

beforeAll(async () => {
  await db.execute(sql`
    INSERT INTO users (id, email, email_verified, name)
    VALUES ('system', 'system@partner.711web.com', true, 'System')
    ON CONFLICT (id) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO workspaces (owner_user_id, name, kind)
    SELECT 'system', 'System', 'system'
    WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE owner_user_id = 'system')
  `);
});
