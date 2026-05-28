import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import pkg from 'pg';
const { Pool } = pkg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: './drizzle' });

  // Ensure the synthetic `system` user + workspace exist. These own any links
  // that pre-date Slice 2's workspace_id constraint, and any future bootstrap
  // data that doesn't belong to a real account. Idempotent.
  const hasUsers =
    (
      await db.execute(
        sql`SELECT 1 FROM information_schema.tables WHERE table_name = 'users'`,
      )
    ).rows.length > 0;
  if (hasUsers) {
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
    // Defensive: heal any links that somehow ended up with NULL workspace_id
    // before the NOT NULL constraint was added (drops to zero on healthy DBs).
    await db.execute(sql`
      UPDATE links
      SET workspace_id = (SELECT id FROM workspaces WHERE owner_user_id = 'system' LIMIT 1)
      WHERE workspace_id IS NULL
    `);
  }

  await pool.end();
  console.log('migrate: done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
