# Slice 1 — Online Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a real, internet-reachable redirect service at `https://partner.711web.com/go/:slug` that looks up the slug in Redis (falling back to Postgres), logs the click asynchronously, and 302s to the destination — backed by a deployable Next.js monolith on UK EC2.

**Architecture:** Single Next.js 15 App Router monolith. Postgres (links + clicks). Redis (link cache, rate-limit later). nginx as the TLS-terminating reverse proxy in front of Node on `:3000`. PM2 supervises Node. Deploys via SSH + git pull from a GitHub Actions workflow. No auth, no dashboards, no AI in this slice — those land in later slices on top of this base.

**Tech Stack:** Node 20 LTS, pnpm 9, Next.js 15 (App Router), TypeScript strict, Drizzle ORM, Postgres 16, Redis 7, Vitest, Playwright (smoke only), nginx, Let's Encrypt (certbot), PM2, GitHub Actions.

**Project root on dev machine:** `/Users/rizwan/referral-platform`
**Production host:** `18.134.35.3` (UK EC2, hostname `partner.711web.com`)
**Repo on production:** `/srv/referral-platform`

**Pre-conditions already satisfied:**
- DNS `A partner.711web.com → 18.134.35.3` is live (Route53 zone `Z09210052K47LJB8FCY3L`, change `C084804030WBSYDW5YM0B` INSYNC).
- UK box already runs nginx + certbot for the `711web.com` parent domain.

---

## File Structure

Files this slice creates or modifies (production paths shown — all under `/Users/rizwan/referral-platform/` locally, `/srv/referral-platform/` in prod):

| Path | Responsibility |
|---|---|
| `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `.gitignore` | Repo metadata |
| `tsconfig.json`, `next.config.mjs` | TS + Next config |
| `vitest.config.ts`, `playwright.config.ts` | Test runners |
| `docker-compose.yml`, `.env.example`, `.env.local` | Local infra |
| `drizzle.config.ts` | Drizzle CLI config |
| `src/db/schema/links.ts` | Drizzle schema for `links` table only (this slice) |
| `src/db/schema/clicks.ts` | Drizzle schema for `clicks` table only (this slice) |
| `src/db/schema/index.ts` | Re-export barrel |
| `src/db/client.ts` | Postgres connection (pg + Drizzle) |
| `src/lib/redis.ts` | Redis client wrapper |
| `src/lib/links/lookup.ts` | `lookupLinkBySlug(slug)` — Redis then PG, populates cache |
| `src/lib/clicks/queue.ts` | In-memory batch writer for click events, 2s flush |
| `src/lib/ids.ts` | ULID generator (one place, used everywhere) |
| `src/app/layout.tsx`, `src/app/page.tsx` | App shell + holding page |
| `src/app/go/[slug]/route.ts` | The hot redirect path |
| `tests/lib/links/lookup.test.ts` | Unit test for lookup |
| `tests/lib/clicks/queue.test.ts` | Unit test for queue |
| `tests/app/go.smoke.test.ts` | Playwright smoke test against running server |
| `scripts/seed-dev.ts` | Insert a couple of test links locally |
| `scripts/db-push.sh` | Apply Drizzle SQL via `psql -f` (workaround for drizzle-kit non-TTY SSH crash on pgEnums — though this slice has no enums yet, we set the pattern now) |
| `deploy/nginx/partner.711web.com.conf` | Production nginx vhost config |
| `deploy/pm2/ecosystem.config.cjs` | PM2 process config |
| `deploy/scripts/bootstrap-server.sh` | One-time host setup (install Node, pnpm, certbot vhost, PM2) |
| `deploy/scripts/deploy.sh` | Runs on the box: pull, install, build, migrate, pm2 reload |
| `.github/workflows/deploy.yml` | GitHub Actions workflow that SSHes and runs `deploy.sh` |
| `README.md` | One-page run-book (local + deploy) |

**Decomposition rationale:** schema split per-table (one table per file) so future slices add `users.ts`, `campaigns.ts`, etc. without touching this slice's files. Hot-path code (`/go/[slug]/route.ts`) is deliberately thin — all heavy lifting lives in `lib/links/lookup.ts` and `lib/clicks/queue.ts` which are unit-testable without Next.

---

## Task 1: Repo bootstrap

**Files:**
- Create: `package.json`
- Create: `.nvmrc`
- Create: `.gitignore`
- Create: `tsconfig.json`

- [ ] **Step 1.1: Initialize git repo + Node version**

Run from `/Users/rizwan/referral-platform`:
```bash
git init
echo "20" > .nvmrc
```

- [ ] **Step 1.2: Write `.gitignore`**

```gitignore
node_modules
.next
dist
.env
.env.local
.env.*.local
*.log
.DS_Store
coverage
playwright-report
test-results
```

- [ ] **Step 1.3: Write `package.json`**

```json
{
  "name": "referral-platform",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:push": "bash scripts/db-push.sh",
    "seed": "tsx scripts/seed-dev.ts"
  },
  "dependencies": {
    "next": "15.0.3",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "drizzle-orm": "0.36.4",
    "pg": "8.13.1",
    "ioredis": "5.4.1",
    "ulid": "2.3.0"
  },
  "devDependencies": {
    "@types/node": "20.17.6",
    "@types/pg": "8.11.10",
    "@types/react": "19.0.1",
    "@types/react-dom": "19.0.1",
    "@playwright/test": "1.49.0",
    "drizzle-kit": "0.28.1",
    "tsx": "4.19.2",
    "typescript": "5.6.3",
    "vitest": "2.1.5"
  },
  "packageManager": "pnpm@9.12.3"
}
```

- [ ] **Step 1.4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "allowJs": false,
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*", "tests/**/*", "scripts/**/*", ".next/types/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.5: Install deps**

Run: `pnpm install`
Expected: lockfile created, `node_modules/` populated, no peer warnings critical.

- [ ] **Step 1.6: Commit**

```bash
git add .gitignore .nvmrc package.json pnpm-lock.yaml tsconfig.json
git commit -m "chore: bootstrap repo with Next 15 + Drizzle + pg + redis deps"
```

---

## Task 2: Local infra via Homebrew (native services)

> Plan deviation 2026-05-28: switched from docker-compose to native brew because Docker wasn't installed and brew is faster + matches prod (the UK box runs apt-installed native services, not Docker).

**Files:**
- Create: `.env.example`
- Create: `.env.local` (gitignored)

- [ ] **Step 2.1: Install services via Homebrew**

```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
```

- [ ] **Step 2.2: Create `referral` role + database**

```bash
psql postgres -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='referral') THEN CREATE ROLE referral LOGIN PASSWORD 'dev_only_referral_pw'; END IF; END \$\$;"
psql postgres -c "CREATE DATABASE referral OWNER referral;"
```

- [ ] **Step 2.3: Write `.env.example`**

```env
DATABASE_URL=postgres://referral:dev_only_referral_pw@localhost:5432/referral
REDIS_URL=redis://localhost:6379
SHORT_DOMAIN=partner.711web.com
NODE_ENV=development
```

- [ ] **Step 2.4: Copy to `.env.local` (gitignored)**

```bash
cp .env.example .env.local
```

- [ ] **Step 2.5: Smoke-test connections**

```bash
psql -U referral -d referral -h localhost -c 'select 1;'
redis-cli ping
```
Expected: `1` from Postgres, `PONG` from Redis.

- [ ] **Step 2.6: Commit**

```bash
git add .env.example
git commit -m "chore: env example pointing at local postgres + redis"
```

---

## Task 3: Drizzle schema + migration (links + clicks only)

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/schema/links.ts`
- Create: `src/db/schema/clicks.ts`
- Create: `src/db/schema/index.ts`
- Create: `src/db/client.ts`
- Create: `scripts/db-migrate.ts`

- [ ] **Step 3.1: Write `drizzle.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
});
```

Also install `dotenv`: `pnpm add dotenv`.

- [ ] **Step 3.2: Write `src/db/schema/links.ts`**

```ts
import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';

export const links = pgTable(
  'links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    destinationUrl: text('destination_url').notNull(),
    workspaceId: uuid('workspace_id'), // nullable in slice 1; FK added in slice 2
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: index('links_slug_idx').on(t.slug),
  }),
);

export type Link = typeof links.$inferSelect;
```

- [ ] **Step 3.3: Write `src/db/schema/clicks.ts`**

```ts
import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { links } from './links';

export const clicks = pgTable(
  'clicks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    linkId: uuid('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    country: text('country'),
    device: text('device'),
    referrer: text('referrer'),
    clickIdCookie: text('click_id_cookie').notNull(),
  },
  (t) => ({
    linkTsIdx: index('clicks_link_ts_idx').on(t.linkId, t.ts),
    clickIdIdx: index('clicks_click_id_idx').on(t.clickIdCookie),
  }),
);

export type Click = typeof clicks.$inferSelect;
export type NewClick = typeof clicks.$inferInsert;
```

- [ ] **Step 3.4: Write `src/db/schema/index.ts`**

```ts
export * from './links';
export * from './clicks';
```

- [ ] **Step 3.5: Write `src/db/client.ts`**

```ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL not set');

export const pool = new Pool({ connectionString: url, max: 10 });
export const db = drizzle(pool, { schema });
```

- [ ] **Step 3.6: Write `scripts/db-migrate.ts`**

Uses Drizzle's non-interactive migrator (tracks applied migrations in `__drizzle_migrations`), so repeated runs are idempotent. Distinct from `drizzle-kit push`, which is the one that crashes over non-TTY SSH.

```ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './drizzle' });
  await pool.end();
  // eslint-disable-next-line no-console
  console.log('migrate: done');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
```

Update `package.json` `scripts.db:push`:

```json
"db:push": "pnpm exec drizzle-kit generate && tsx scripts/db-migrate.ts",
```

- [ ] **Step 3.7: Generate + apply initial migration**

```bash
pnpm db:push
```
Expected: prints something like `[✓] Your SQL migration file ➜ drizzle/0000_*.sql` then `migrate: done`. Re-running the command is safe and prints `migrate: done` with no changes. Verify with:
```bash
docker compose exec -T postgres psql -U referral -d referral -c '\dt'
```
Expected: `clicks` and `links` listed.

- [ ] **Step 3.8: Commit**

```bash
git add drizzle.config.ts src/db scripts/db-migrate.ts drizzle/ package.json
git commit -m "feat(db): links + clicks schema with idempotent drizzle migrator"
```

---

## Task 4: ID + Redis utilities

**Files:**
- Create: `src/lib/ids.ts`
- Create: `src/lib/redis.ts`

- [ ] **Step 4.1: Write `src/lib/ids.ts`**

```ts
import { ulid } from 'ulid';

export function newClickId(): string {
  return ulid();
}

export function newLinkId(): string {
  return ulid();
}
```

- [ ] **Step 4.2: Write `src/lib/redis.ts`**

```ts
import Redis from 'ioredis';

const url = process.env.REDIS_URL;
if (!url) throw new Error('REDIS_URL not set');

export const redis = new Redis(url, {
  lazyConnect: false,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('error', (e) => {
  // eslint-disable-next-line no-console
  console.error('[redis]', e.message);
});
```

- [ ] **Step 4.3: Commit**

```bash
git add src/lib/ids.ts src/lib/redis.ts
git commit -m "feat(lib): ulid id factory + ioredis client"
```

---

## Task 5: Link lookup (Redis-then-Postgres)

**Files:**
- Create: `src/lib/links/lookup.ts`
- Create: `tests/lib/links/lookup.test.ts`

- [ ] **Step 5.1: Set up Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/*.smoke.test.ts'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
```

Create `tests/setup.ts`:
```ts
import 'dotenv/config';
```

- [ ] **Step 5.2: Write the failing test `tests/lib/links/lookup.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db, pool } from '@/db/client';
import { links } from '@/db/schema';
import { redis } from '@/lib/redis';
import { lookupLinkBySlug } from '@/lib/links/lookup';

describe('lookupLinkBySlug', () => {
  beforeAll(async () => {
    await db.delete(links);
    await redis.flushdb();
    await db.insert(links).values({
      slug: 'hello',
      destinationUrl: 'https://example.com/landing',
    });
  });

  beforeEach(async () => {
    await redis.del('link:hello');
  });

  afterAll(async () => {
    await db.delete(links);
    await redis.flushdb();
    await redis.quit();
    await pool.end();
  });

  it('returns the link on cache miss and populates Redis', async () => {
    const link = await lookupLinkBySlug('hello');
    expect(link).not.toBeNull();
    expect(link!.destinationUrl).toBe('https://example.com/landing');
    const cached = await redis.get('link:hello');
    expect(cached).not.toBeNull();
  });

  it('returns the link from Redis on cache hit (no PG query)', async () => {
    await lookupLinkBySlug('hello'); // populate cache
    const link = await lookupLinkBySlug('hello');
    expect(link).not.toBeNull();
    expect(link!.slug).toBe('hello');
  });

  it('returns null for unknown slug', async () => {
    const link = await lookupLinkBySlug('does-not-exist');
    expect(link).toBeNull();
  });
});
```

- [ ] **Step 5.3: Run test, confirm it fails**

```bash
pnpm test tests/lib/links/lookup.test.ts
```
Expected: FAIL — `lookupLinkBySlug` not exported.

- [ ] **Step 5.4: Write `src/lib/links/lookup.ts`**

```ts
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
```

- [ ] **Step 5.5: Run test, confirm it passes**

```bash
pnpm test tests/lib/links/lookup.test.ts
```
Expected: 3 passing.

- [ ] **Step 5.6: Commit**

```bash
git add src/lib/links/lookup.ts tests/lib/links/lookup.test.ts vitest.config.ts tests/setup.ts
git commit -m "feat(links): Redis-cached slug lookup with negative caching"
```

---

## Task 6: Async click batch writer

**Files:**
- Create: `src/lib/clicks/queue.ts`
- Create: `tests/lib/clicks/queue.test.ts`

- [ ] **Step 6.1: Write the failing test `tests/lib/clicks/queue.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db, pool } from '@/db/client';
import { clicks, links } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueClick, flushClicks, _resetQueue } from '@/lib/clicks/queue';

let linkId: string;

describe('clicks queue', () => {
  beforeAll(async () => {
    await db.delete(clicks);
    await db.delete(links);
    const [row] = await db
      .insert(links)
      .values({ slug: 'qtest', destinationUrl: 'https://example.com' })
      .returning();
    linkId = row!.id;
  });

  beforeEach(() => {
    _resetQueue();
  });

  afterAll(async () => {
    await db.delete(clicks);
    await db.delete(links);
    await pool.end();
  });

  it('flushes a single enqueued click to Postgres', async () => {
    enqueueClick({ linkId, clickIdCookie: 'c1', userAgent: 'ua', referrer: null });
    await flushClicks();
    const rows = await db.select().from(clicks).where(eq(clicks.linkId, linkId));
    expect(rows.length).toBe(1);
    expect(rows[0]!.clickIdCookie).toBe('c1');
  });

  it('batches multiple enqueued clicks in one flush', async () => {
    enqueueClick({ linkId, clickIdCookie: 'a', userAgent: 'ua', referrer: null });
    enqueueClick({ linkId, clickIdCookie: 'b', userAgent: 'ua', referrer: null });
    enqueueClick({ linkId, clickIdCookie: 'c', userAgent: 'ua', referrer: null });
    await flushClicks();
    const rows = await db.select().from(clicks).where(eq(clicks.linkId, linkId));
    expect(rows.length).toBe(3);
  });

  it('does nothing when queue is empty', async () => {
    await expect(flushClicks()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 6.2: Run test, confirm it fails**

```bash
pnpm test tests/lib/clicks/queue.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 6.3: Write `src/lib/clicks/queue.ts`**

```ts
import { db } from '@/db/client';
import { clicks, type NewClick } from '@/db/schema';

let buffer: NewClick[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL_MS = 2000;
const MAX_BUFFER = 500;

export type EnqueueInput = {
  linkId: string;
  clickIdCookie: string;
  userAgent?: string | null;
  referrer?: string | null;
  country?: string | null;
  device?: string | null;
  ipHash?: string | null;
};

export function enqueueClick(input: EnqueueInput): void {
  buffer.push({
    linkId: input.linkId,
    clickIdCookie: input.clickIdCookie,
    userAgent: input.userAgent ?? null,
    referrer: input.referrer ?? null,
    country: input.country ?? null,
    device: input.device ?? null,
    ipHash: input.ipHash ?? null,
  });
  if (buffer.length >= MAX_BUFFER) {
    void flushClicks();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      void flushClicks();
    }, FLUSH_INTERVAL_MS);
  }
}

export async function flushClicks(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  try {
    await db.insert(clicks).values(batch);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[clicks-queue] flush failed; dropping batch', e);
  }
}

export function _resetQueue(): void {
  buffer = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
```

- [ ] **Step 6.4: Run test, confirm it passes**

```bash
pnpm test tests/lib/clicks/queue.test.ts
```
Expected: 3 passing.

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/clicks/queue.ts tests/lib/clicks/queue.test.ts
git commit -m "feat(clicks): async batch writer with 2s flush + 500 max buffer"
```

---

## Task 7: Next.js app shell

**Files:**
- Create: `next.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

- [ ] **Step 7.1: Write `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '1mb' },
  },
};
export default nextConfig;
```

- [ ] **Step 7.2: Write `src/app/layout.tsx`**

```tsx
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Partner',
  description: 'AI-powered referral platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 24 }}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7.3: Write `src/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>Partner</h1>
      <p>Referral platform — early build. Nothing to see yet.</p>
    </main>
  );
}
```

- [ ] **Step 7.4: Verify dev server starts**

```bash
pnpm dev
```
Then in another terminal:
```bash
curl -s http://localhost:3000 | grep '<h1>Partner</h1>'
```
Expected: prints the matching line. Kill the dev server with Ctrl-C.

- [ ] **Step 7.5: Commit**

```bash
git add next.config.mjs src/app/layout.tsx src/app/page.tsx
git commit -m "feat(app): minimal next 15 shell + holding page"
```

---

## Task 8: Hot redirect route `/go/[slug]`

**Files:**
- Create: `src/app/go/[slug]/route.ts`

- [ ] **Step 8.1: Write `src/app/go/[slug]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { lookupLinkBySlug } from '@/lib/links/lookup';
import { enqueueClick } from '@/lib/clicks/queue';
import { newClickId } from '@/lib/ids';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = '_clid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

function parseDevice(ua: string | null): string | null {
  if (!ua) return null;
  if (/iPhone|Android.*Mobile|Mobile/.test(ua)) return 'mobile';
  if (/iPad|Tablet/.test(ua)) return 'tablet';
  return 'desktop';
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const link = await lookupLinkBySlug(slug);
  if (!link) {
    return new NextResponse('Not found', { status: 404 });
  }

  const existing = req.cookies.get(COOKIE_NAME)?.value;
  const clickId = existing ?? newClickId();

  const ua = req.headers.get('user-agent');
  const country = req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry');
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip');

  enqueueClick({
    linkId: link.id,
    clickIdCookie: clickId,
    userAgent: ua,
    referrer: req.headers.get('referer'),
    country: country ?? null,
    device: parseDevice(ua),
    ipHash: hashIp(ip ?? null),
  });

  const dest = new URL(link.destinationUrl);
  dest.searchParams.set('utm_source', process.env.SHORT_DOMAIN ?? 'partner.711web.com');
  dest.searchParams.set('utm_campaign', slug);

  const res = NextResponse.redirect(dest.toString(), 302);
  res.cookies.set(COOKIE_NAME, clickId, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false, // pixel needs to read it later (slice 3)
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
```

- [ ] **Step 8.2: Manually verify the route locally**

Insert a test row, start dev, hit the route:
```bash
docker compose exec -T postgres psql -U referral -d referral -c \
  "insert into links (slug, destination_url) values ('demo', 'https://example.com/page') on conflict (slug) do nothing;"

pnpm dev &  # background
sleep 4
curl -sI http://localhost:3000/go/demo | head -20
```
Expected output contains:
```
HTTP/1.1 302
location: https://example.com/page?utm_source=partner.711web.com&utm_campaign=demo
set-cookie: _clid=...; Path=/; ...
```

Then verify the click was logged (wait 3s for the queue flush):
```bash
sleep 3
docker compose exec -T postgres psql -U referral -d referral -c \
  "select link_id, click_id_cookie, device from clicks order by ts desc limit 5;"
```
Expected: at least one row matching the demo link with the cookie value.

Kill the dev server: `kill %1` (or Ctrl-C if foreground).

- [ ] **Step 8.3: Verify 404 path**

```bash
pnpm dev &
sleep 4
curl -sI http://localhost:3000/go/no-such-slug | head -3
kill %1
```
Expected: `HTTP/1.1 404`.

- [ ] **Step 8.4: Commit**

```bash
git add src/app/go/[slug]/route.ts
git commit -m "feat(go): /go/:slug redirect with cookie + async click logging"
```

---

## Task 9: Playwright smoke test (runs against running server)

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/app/go.smoke.test.ts`

- [ ] **Step 9.1: Install Playwright browsers**

```bash
pnpm exec playwright install chromium
```

- [ ] **Step 9.2: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.smoke.test.ts',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://localhost:3000',
    extraHTTPHeaders: { 'user-agent': 'playwright-smoke' },
  },
  webServer: process.env.SMOKE_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        port: 3000,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
```

- [ ] **Step 9.3: Write `tests/app/go.smoke.test.ts`**

```ts
import { test, expect, request } from '@playwright/test';

test('GET /go/demo redirects 302 to destination with utm + cookie', async ({ baseURL }) => {
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  const res = await api.get('/go/demo', { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const location = res.headers()['location'];
  expect(location).toMatch(/^https:\/\/example\.com\/page\?/);
  expect(location).toContain('utm_source=partner.711web.com');
  expect(location).toContain('utm_campaign=demo');
  const setCookie = res.headers()['set-cookie'] ?? '';
  expect(setCookie).toMatch(/_clid=/);
});

test('GET /go/no-such-slug returns 404', async ({ baseURL }) => {
  const api = await request.newContext({ baseURL });
  const res = await api.get('/go/no-such-slug', { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});
```

- [ ] **Step 9.4: Run smoke test locally**

Ensure the `demo` slug exists (from Task 8.2) and run:
```bash
pnpm test:smoke
```
Expected: 2 passing.

- [ ] **Step 9.5: Commit**

```bash
git add playwright.config.ts tests/app/go.smoke.test.ts
git commit -m "test(go): playwright smoke for redirect + 404"
```

---

## Task 10: Seed script

**Files:**
- Create: `scripts/seed-dev.ts`

- [ ] **Step 10.1: Write `scripts/seed-dev.ts`**

```ts
import 'dotenv/config';
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
  // eslint-disable-next-line no-console
  console.log('seeded', seed.length, 'links');
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 10.2: Run seed**

```bash
pnpm seed
```
Expected: `seeded 3 links`. Verify:
```bash
docker compose exec -T postgres psql -U referral -d referral -c 'select slug from links;'
```
Expected: `demo`, `docs`, `pricing`.

- [ ] **Step 10.3: Commit**

```bash
git add scripts/seed-dev.ts
git commit -m "chore: dev seed script with 3 sample links"
```

---

## Task 11: Production nginx vhost + TLS

**Files:**
- Create: `deploy/nginx/partner.711web.com.conf`
- Create: `deploy/scripts/bootstrap-server.sh`

These run **on the UK box** (`18.134.35.3`). Run them via `ssh ubuntu@18.134.35.3` (use whatever user works on that box — adjust if the user is `ec2-user` or root).

- [ ] **Step 11.1: Write `deploy/nginx/partner.711web.com.conf`**

```nginx
upstream partner_app {
    server 127.0.0.1:3000 fail_timeout=0;
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name partner.711web.com;

    # ACME challenges served from filesystem (certbot webroot)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name partner.711web.com;

    ssl_certificate     /etc/letsencrypt/live/partner.711web.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/partner.711web.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # Static pixel file in slice 3 — for now Next handles everything
    location / {
        proxy_pass http://partner_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }
}
```

- [ ] **Step 11.2: Write `deploy/scripts/bootstrap-server.sh` (run once on prod)**

```bash
#!/usr/bin/env bash
# Run as root or with sudo on 18.134.35.3.
set -euo pipefail

APP_USER=${APP_USER:-ubuntu}
APP_DIR=/srv/referral-platform

# 1. Node 20 via nvm for APP_USER
sudo -u "$APP_USER" bash -lc '
  if [ ! -d "$HOME/.nvm" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi
  export NVM_DIR="$HOME/.nvm"
  . "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm alias default 20
  corepack enable
  corepack prepare pnpm@9.12.3 --activate
'

# 2. Postgres 16 + Redis 7 via apt (or docker — pick one path; this uses native packages)
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16 redis-server nginx certbot python3-certbot-nginx

systemctl enable --now postgresql redis-server nginx

# 3. App user + dir
id -u "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# 4. Postgres DB + role
sudo -u postgres psql <<SQL
  DO \$\$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'referral') THEN
      CREATE ROLE referral LOGIN PASSWORD '__SET_ME__';
    END IF;
  END \$\$;
  CREATE DATABASE referral OWNER referral;
SQL

# 5. PM2 globally for the app user
sudo -u "$APP_USER" bash -lc '
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
  npm i -g pm2
  pm2 startup systemd -u '"$APP_USER"' --hp /home/'"$APP_USER"' | tail -1 | bash || true
'

# 6. nginx vhost + cert (cert obtained after first DNS-served HTTP request works)
# The nginx config is scp'd to /tmp/ before this script runs (see Task 11.3).
cp /tmp/partner.711web.com.conf /etc/nginx/sites-available/partner.711web.com
ln -sf /etc/nginx/sites-available/partner.711web.com /etc/nginx/sites-enabled/partner.711web.com
mkdir -p /var/www/certbot

# Serve port 80 first (no TLS yet) by temporarily commenting the 443 block, fetch cert, then re-enable.
# Simplest: use certbot --nginx which edits the file itself.
nginx -t && systemctl reload nginx
certbot --nginx -d partner.711web.com --non-interactive --agree-tos -m 711webservices@gmail.com --redirect

echo 'Bootstrap complete. Now ssh in, set DB password, set .env, deploy.'
```

Mark executable: `chmod +x deploy/scripts/bootstrap-server.sh`.

- [ ] **Step 11.3: Copy + run bootstrap on the UK box**

From local:
```bash
scp deploy/scripts/bootstrap-server.sh deploy/nginx/partner.711web.com.conf ubuntu@18.134.35.3:/tmp/
ssh ubuntu@18.134.35.3 'sudo APP_USER=ubuntu bash /tmp/bootstrap-server.sh'
```
Expected: ends with `Bootstrap complete.` and `certbot` has obtained `/etc/letsencrypt/live/partner.711web.com/fullchain.pem`. If the cert step fails, fix DNS/nginx first; do not proceed.

Verify TLS works (Next not running yet, expect 502 but correct cert):
```bash
curl -sI https://partner.711web.com | head -5
```
Expected: `HTTP/2 502` (because no upstream yet) and a valid TLS handshake (no cert errors).

- [ ] **Step 11.4: Set DB password on production**

```bash
ssh ubuntu@18.134.35.3
sudo -u postgres psql -c "ALTER ROLE referral PASSWORD 'replace-with-strong-pw';"
```
Note this password; it goes into the production `.env` in Task 13.

- [ ] **Step 11.5: Commit**

```bash
git add deploy/
git commit -m "infra: nginx vhost + bootstrap script for partner.711web.com"
```

---

## Task 12: PM2 process config

**Files:**
- Create: `deploy/pm2/ecosystem.config.cjs`

- [ ] **Step 12.1: Write `deploy/pm2/ecosystem.config.cjs`**

```js
module.exports = {
  apps: [
    {
      name: 'partner-app',
      cwd: '/srv/referral-platform',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      env_file: '/srv/referral-platform/.env',
    },
  ],
};
```

- [ ] **Step 12.2: Commit**

```bash
git add deploy/pm2/
git commit -m "infra: pm2 ecosystem config for partner-app"
```

---

## Task 13: Deploy script + first deploy

**Files:**
- Create: `deploy/scripts/deploy.sh`

- [ ] **Step 13.1: Write `deploy/scripts/deploy.sh` (runs on the box)**

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/srv/referral-platform
cd "$APP_DIR"

export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20

git fetch --all --prune
git reset --hard origin/main
pnpm install --frozen-lockfile
pnpm db:push
pnpm build

pm2 startOrReload deploy/pm2/ecosystem.config.cjs --update-env
pm2 save
echo 'deploy: done'
```

Mark executable: `chmod +x deploy/scripts/deploy.sh`.

- [ ] **Step 13.2: Push repo to GitHub**

Create a GitHub repo (call it whatever — `referral-platform`). Then:
```bash
git remote add origin git@github.com:<your-user>/referral-platform.git
git branch -M main
git push -u origin main
```

- [ ] **Step 13.3: Clone on the box + first manual deploy**

```bash
ssh ubuntu@18.134.35.3
sudo -u ubuntu bash <<'EOSSH'
  cd /srv
  if [ ! -d referral-platform/.git ]; then
    git clone git@github.com:<your-user>/referral-platform.git referral-platform
  fi
  cd referral-platform
  # Write production .env (DO NOT commit this)
  cat > .env <<EOF
DATABASE_URL=postgres://referral:replace-with-strong-pw@localhost:5432/referral
REDIS_URL=redis://localhost:6379
SHORT_DOMAIN=partner.711web.com
NODE_ENV=production
EOF
  chmod 600 .env
  bash deploy/scripts/deploy.sh
EOSSH
```
Expected: ends with `deploy: done` and `pm2 list` shows `partner-app` as `online`.

- [ ] **Step 13.4: Seed a link in prod for the smoke test**

```bash
ssh ubuntu@18.134.35.3 "sudo -u postgres psql referral -c \"insert into links (slug, destination_url) values ('demo', 'https://example.com/page') on conflict (slug) do nothing;\""
```

- [ ] **Step 13.5: Production smoke from your laptop**

```bash
curl -sI https://partner.711web.com | head -3
curl -sI https://partner.711web.com/go/demo | head -5
curl -sI https://partner.711web.com/go/no-such | head -3
```
Expected:
- `HTTP/2 200` on the root
- `HTTP/2 302` with a `location: https://example.com/page?utm_...` on `/go/demo`
- `HTTP/2 404` on the unknown slug

Then run the Playwright smoke against production:
```bash
SMOKE_BASE_URL=https://partner.711web.com pnpm test:smoke
```
Expected: 2 passing.

- [ ] **Step 13.6: Commit**

```bash
git add deploy/scripts/deploy.sh
git commit -m "infra: deploy script (git pull, install, migrate, build, pm2 reload)"
git push
```

---

## Task 14: GitHub Actions auto-deploy

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 14.1: Add deploy SSH key**

On your laptop, generate a deploy keypair and put the **public** half in `ubuntu@18.134.35.3:~/.ssh/authorized_keys`. Put the **private** half in the GitHub repo as secret `DEPLOY_SSH_KEY`. Also add secrets:
- `DEPLOY_HOST` = `18.134.35.3`
- `DEPLOY_USER` = `ubuntu`

- [ ] **Step 14.2: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.3

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test

      - name: SSH and deploy
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /srv/referral-platform
            bash deploy/scripts/deploy.sh

      - name: Production smoke
        run: |
          curl -fsSI https://partner.711web.com | head -1
          curl -fsSI https://partner.711web.com/go/demo | grep -i '^location:' | grep -q example.com
```

- [ ] **Step 14.3: Push and verify the workflow runs green**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Actions auto-deploy on push to main"
git push
```

Watch the workflow on GitHub. Expected: green run, ends with the smoke step finding `example.com` in the Location header.

---

## Task 15: README run-book

**Files:**
- Create: `README.md`

- [ ] **Step 15.1: Write `README.md`**

```markdown
# Referral Platform

AI-powered referral platform. See spec at `docs/superpowers/specs/2026-05-28-ai-referral-platform-design.md`.

## Local dev

    cp .env.example .env.local
    docker compose up -d
    pnpm install
    pnpm db:push
    pnpm seed
    pnpm dev
    open http://localhost:3000/go/demo

## Tests

    pnpm test            # unit (vitest)
    pnpm test:smoke      # playwright against localhost
    SMOKE_BASE_URL=https://partner.711web.com pnpm test:smoke

## Production

- Host: `partner.711web.com` (`18.134.35.3`, UK EC2)
- Auto-deploys on push to `main` via `.github/workflows/deploy.yml`
- Manual deploy: `ssh ubuntu@18.134.35.3 'cd /srv/referral-platform && bash deploy/scripts/deploy.sh'`
- One-time bootstrap: `bash deploy/scripts/bootstrap-server.sh` (as root on the box)
```

- [ ] **Step 15.2: Commit**

```bash
git add README.md
git commit -m "docs: README run-book for local + prod"
git push
```

---

## Slice 1 — Done Criteria (all must hold)

- [ ] `https://partner.711web.com` returns HTTP 200 with a valid TLS cert.
- [ ] `https://partner.711web.com/go/demo` returns HTTP 302 with `Location: https://example.com/page?utm_source=partner.711web.com&utm_campaign=demo` and a `_clid` cookie.
- [ ] After hitting `/go/demo`, a row appears in `clicks` within 3 seconds with that cookie value.
- [ ] `https://partner.711web.com/go/<unknown>` returns 404.
- [ ] All Vitest unit tests pass locally.
- [ ] Playwright smoke passes against production with `SMOKE_BASE_URL=https://partner.711web.com`.
- [ ] A push to `main` triggers GitHub Actions, deploys, and the workflow goes green including the smoke step.

When all six bullets are checked, Slice 1 is done and Slice 2 (auth + workspaces + link UI) can start.

---

## What's deliberately NOT in this slice

- Auth, signup, login, sessions, workspaces. (Slice 2.)
- Any dashboard / UI beyond the holding page. (Slice 2.)
- Campaigns, tracking links, conversions, commissions, pixel, webhook. (Slices 3–4.)
- AI features, OpenRouter, credit packs, Stripe. (Slice 5.)
- Email, payouts, matching. (Slice 6.)
- IP-geo lookup. (Country is read from headers; populated by reverse-proxy GeoIP later if needed.)
- Custom branded short domains beyond `SHORT_DOMAIN` env. (Later.)
- Rate limiting on `/go/:slug`. (Easy add via Redis sliding-window after Slice 2 lands the rate-limit helper for auth endpoints.)
