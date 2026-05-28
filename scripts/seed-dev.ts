import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { sql } from 'drizzle-orm';
import { db, pool } from '../src/db/client.js';
import { links } from '../src/db/schema/index.js';

async function main() {
  // Ensure system user + workspace exist (idempotent)
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
  const rows = (await db.execute(
    sql`SELECT id FROM workspaces WHERE owner_user_id = 'system' LIMIT 1`,
  )).rows as Array<{ id: string }>;
  const systemWsId = rows[0]?.id;
  if (!systemWsId) throw new Error('system workspace not found after insert');

  const seed = [
    { slug: 'demo', destinationUrl: 'https://example.com/page' },
    { slug: 'docs', destinationUrl: 'https://example.com/docs' },
    { slug: 'pricing', destinationUrl: 'https://example.com/pricing' },
  ];
  for (const row of seed) {
    await db
      .insert(links)
      .values({ ...row, workspaceId: systemWsId })
      .onConflictDoNothing({ target: links.slug });
  }
  console.log('seeded', seed.length, 'links');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
