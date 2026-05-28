import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { db, pool } from '../src/db/client.js';
import { links } from '../src/db/schema/index.js';

async function main() {
  const seed = [
    { slug: 'demo', destinationUrl: 'https://example.com/page' },
    { slug: 'docs', destinationUrl: 'https://example.com/docs' },
    { slug: 'pricing', destinationUrl: 'https://example.com/pricing' },
  ];
  for (const row of seed) {
    await db.insert(links).values(row).onConflictDoNothing({ target: links.slug });
  }
  console.log('seeded', seed.length, 'links');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
