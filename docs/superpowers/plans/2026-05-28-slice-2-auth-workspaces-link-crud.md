# Slice 2 — Auth + Workspaces + Link CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship signup/login + auto-created single workspace per user + a dashboard at `/app` where authenticated users can create, list, edit, and delete their own short links.

**Architecture:** Better-Auth (email + password) using the Drizzle adapter, persisted alongside our existing `links`/`clicks` tables. Workspaces are singleton-per-user, auto-created at signup with `kind='creator'`. The slice-1 `/go/[slug]` redirect path remains untouched and continues to work against the same `links` table; we just upgrade `links.workspace_id` from nullable to NOT NULL and backfill the existing seeded rows into a `system` workspace.

**Tech Stack:** Better-Auth ^1.2 + drizzle adapter, Next.js 15.5.18 App Router (server actions), Tailwind v4 for styling, Drizzle ORM (existing), Vitest + Playwright (existing).

**Pre-conditions:**
- Slice 1 is shipped: schema migrations work, `partner-app` is live at `partner.711web.com`, auto-deploy on push to main is green.
- Repo root: `/Users/rizwan/referral-platform`. Production path: `/srv/referral-platform`.
- Slice 2 swaps the original spec's choice of Lucia for Better-Auth (Lucia was deprecated by its author in 2025). Better-Auth is the closest spirit-successor and gives us OAuth + magic links for free when Slice 5 wants them.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/db/schema/auth.ts` | Better-Auth tables: `users`, `sessions`, `accounts`, `verifications` |
| `src/db/schema/workspaces.ts` | `workspaces` table (singleton-per-user for now) |
| `src/db/schema/links.ts` *(modify)* | Tighten `workspace_id` to NOT NULL + FK to workspaces |
| `src/db/schema/index.ts` *(modify)* | Re-export auth + workspaces |
| `src/lib/auth/server.ts` | Better-Auth instance + Drizzle adapter wiring |
| `src/lib/auth/session.ts` | `getSession()` helper for server components & actions |
| `src/lib/workspaces/ensure.ts` | `ensureWorkspaceForUser(userId)` — idempotent singleton creation |
| `src/lib/links/queries.ts` | `listLinks`, `createLink`, `updateLink`, `deleteLink` (workspace-scoped) + `getLinkBySlugAndWorkspace` |
| `src/app/api/auth/[...all]/route.ts` | Better-Auth's catch-all auth route |
| `src/app/(auth)/signup/page.tsx` | Signup form (client component) |
| `src/app/(auth)/signup/actions.ts` | Signup server action |
| `src/app/(auth)/login/page.tsx` | Login form |
| `src/app/(auth)/login/actions.ts` | Login server action |
| `src/app/(auth)/layout.tsx` | Auth layout (centered card) |
| `src/app/(dashboard)/layout.tsx` | Dashboard layout — sidebar + auth gate |
| `src/app/(dashboard)/app/page.tsx` | Links list page with click counts |
| `src/app/(dashboard)/app/new/page.tsx` | Create-link form |
| `src/app/(dashboard)/app/[id]/edit/page.tsx` | Edit-link form |
| `src/app/(dashboard)/app/actions.ts` | `createLinkAction`, `updateLinkAction`, `deleteLinkAction`, `logoutAction` |
| `src/app/page.tsx` *(modify)* | Holding page → tiny landing pointing to /signup and /login |
| `src/app/globals.css` *(new)* | Tailwind v4 base import |
| `tests/lib/workspaces/ensure.test.ts` | Test workspace singleton creation |
| `tests/lib/links/queries.test.ts` | Test workspace-scoped CRUD |
| `tests/app/auth.smoke.test.ts` | Playwright: signup → create-link → see-link → logout flow |
| `package.json` *(modify)* | Add `better-auth`, `tailwindcss@4`, `@tailwindcss/postcss`, `bcrypt-ts` if needed |
| `postcss.config.mjs` *(new)* | Tailwind v4 PostCSS plugin |

**Decomposition rationale:** auth and workspaces are isolated in `src/lib/auth/` and `src/lib/workspaces/`. Link queries gain a `queries.ts` module that future slices (campaigns) can compose against. Route groups split unauthenticated `(auth)` and authenticated `(dashboard)` flows. The Slice 1 redirect path (`src/app/go/[slug]/route.ts`) and its supporting `src/lib/links/lookup.ts` are not touched — they keep working against `links.slug` regardless of workspace.

---

## Task 1: Better-Auth schema + Drizzle additions

**Files:**
- Create: `src/db/schema/auth.ts`
- Modify: `src/db/schema/index.ts`
- Modify: `package.json`

- [ ] **Step 1.1: Add Better-Auth dep**

```bash
pnpm add better-auth@^1.2.7
```

- [ ] **Step 1.2: Write `src/db/schema/auth.ts`**

```ts
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
```

- [ ] **Step 1.3: Update `src/db/schema/index.ts`** (Edit, don't Write)

Add `export * from './auth';` at the top.

- [ ] **Step 1.4: Generate + apply migration**

```bash
pnpm db:push
psql -U referral -d referral -h localhost -c '\dt'
```
Expected: tables `users`, `sessions`, `accounts`, `verifications` now exist alongside `links`, `clicks`, `__drizzle_migrations`.

- [ ] **Step 1.5: Commit**

```bash
git add src/db/schema/auth.ts src/db/schema/index.ts drizzle/ package.json pnpm-lock.yaml
git commit -m "feat(auth): Better-Auth schema (users/sessions/accounts/verifications)"
```

---

## Task 2: Workspaces schema

**Files:**
- Create: `src/db/schema/workspaces.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 2.1: Write `src/db/schema/workspaces.ts`**

```ts
import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: text('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['creator', 'brand', 'system'] }).notNull().default('creator'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index('workspaces_owner_idx').on(t.ownerUserId),
  }),
);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
```

- [ ] **Step 2.2: Update `src/db/schema/index.ts`**

Add `export * from './workspaces';`.

- [ ] **Step 2.3: Apply migration**

```bash
pnpm db:push
psql -U referral -d referral -h localhost -c '\d workspaces'
```
Expected: `workspaces` table exists with the four columns.

- [ ] **Step 2.4: Commit**

```bash
git add src/db/schema/workspaces.ts src/db/schema/index.ts drizzle/
git commit -m "feat(db): workspaces table with owner FK + kind enum"
```

---

## Task 3: Backfill existing links + tighten `links.workspace_id`

**Files:**
- Modify: `src/db/schema/links.ts`
- Create: `drizzle/<next>_backfill_links_workspace.sql` (Drizzle will name it)

- [ ] **Step 3.1: Create a `system` workspace + backfill in SQL** (apply BEFORE the schema tightens)

We can't simply change `workspace_id` from nullable to NOT NULL because existing rows have NULL. Do a one-time data migration first.

```bash
# Find the owner_user_id placeholder: a synthetic 'system' user we insert just for this.
psql -U referral -d referral -h localhost <<'SQL'
INSERT INTO users (id, email, email_verified, name)
VALUES ('system', 'system@partner.711web.com', true, 'System')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (owner_user_id, name, kind)
SELECT 'system', 'System', 'system'
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE owner_user_id = 'system');

UPDATE links
SET workspace_id = (SELECT id FROM workspaces WHERE owner_user_id = 'system' LIMIT 1)
WHERE workspace_id IS NULL;
SQL
```

Verify: `SELECT COUNT(*) FROM links WHERE workspace_id IS NULL;` → must be `0`.

- [ ] **Step 3.2: Update `src/db/schema/links.ts`** (Edit)

Replace the workspace_id line:
```ts
    workspaceId: uuid('workspace_id'),
```
with:
```ts
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
```

And add the import at the top:
```ts
import { workspaces } from './workspaces';
```

- [ ] **Step 3.3: Generate + apply migration**

```bash
pnpm db:push
```
The Drizzle migrator will add the NOT NULL + FK constraints. If it fails because of remaining NULL rows, return to Step 3.1.

Verify the FK:
```bash
psql -U referral -d referral -h localhost -c '\d links'
```
Expected: `workspace_id` shows `not null` and a FOREIGN KEY constraint to `workspaces(id)`.

- [ ] **Step 3.4: Commit**

```bash
git add src/db/schema/links.ts drizzle/
git commit -m "feat(db): tighten links.workspace_id NOT NULL + FK to workspaces"
```

---

## Task 4: Better-Auth instance

**Files:**
- Create: `src/lib/auth/server.ts`
- Create: `src/app/api/auth/[...all]/route.ts`

- [ ] **Step 4.1: Write `src/lib/auth/server.ts`**

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db/client';
import * as schema from '@/db/schema';

const secret = process.env.AUTH_SECRET;
if (!secret) throw new Error('AUTH_SECRET not set');

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  secret,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    cookies: {
      session_token: { attributes: { sameSite: 'lax' } },
    },
  },
});

export type Auth = typeof auth;
```

- [ ] **Step 4.2: Write `src/app/api/auth/[...all]/route.ts`**

```ts
import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth/server';

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 4.3: Add `AUTH_SECRET` to local + prod env**

Local — append to `.env.example` (template) and `.env.local`:
```bash
AUTH_SECRET=$(openssl rand -base64 32)
```

Update `.env.example` (commit this):
```env
DATABASE_URL=postgres://referral:dev_only_referral_pw@localhost:5432/referral
REDIS_URL=redis://localhost:6379
SHORT_DOMAIN=partner.711web.com
NODE_ENV=development
AUTH_SECRET=replace-with-strong-random-base64
```

Append the generated `AUTH_SECRET=...` line to `.env.local` (gitignored).

On prod (via SSH later): `bootstrap-server.sh` already handles secret generation; we'll update it in Task 14 to also generate `AUTH_SECRET`.

- [ ] **Step 4.4: Smoke-test the auth route is reachable**

```bash
pnpm dev > /tmp/next-dev.log 2>&1 &
sleep 8
curl -sI http://localhost:3000/api/auth/get-session | head -3
lsof -ti:3000 | xargs -r kill -9
```
Expected: 200 with `application/json` body. The body will be `null` (no session yet) but the route exists.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/auth/server.ts src/app/api/auth/ .env.example
git commit -m "feat(auth): Better-Auth instance + Next.js handler at /api/auth"
```

---

## Task 5: `getSession()` helper + `ensureWorkspaceForUser`

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/workspaces/ensure.ts`
- Create: `tests/lib/workspaces/ensure.test.ts`

- [ ] **Step 5.1: Write `src/lib/auth/session.ts`**

```ts
import { headers } from 'next/headers';
import { auth } from './server';

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
```

- [ ] **Step 5.2: Write the failing test `tests/lib/workspaces/ensure.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db, pool } from '@/db/client';
import { users, workspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
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
```

- [ ] **Step 5.3: Run, confirm RED**

```bash
pnpm test tests/lib/workspaces/ensure.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 5.4: Write `src/lib/workspaces/ensure.ts`**

```ts
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
```

- [ ] **Step 5.5: Run, confirm GREEN**

```bash
pnpm test tests/lib/workspaces/ensure.test.ts
```
Expected: 2 passing.

- [ ] **Step 5.6: Commit**

```bash
git add src/lib/auth/session.ts src/lib/workspaces/ensure.ts tests/lib/workspaces/ensure.test.ts
git commit -m "feat(workspaces): idempotent singleton workspace per user + getSession helper"
```

---

## Task 6: Tailwind v4 base styles

**Files:**
- Create: `src/app/globals.css`
- Create: `postcss.config.mjs`
- Modify: `package.json`
- Modify: `src/app/layout.tsx`

- [ ] **Step 6.1: Install Tailwind v4**

```bash
pnpm add -D tailwindcss@^4 @tailwindcss/postcss
```

- [ ] **Step 6.2: Write `postcss.config.mjs`**

```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
};
```

- [ ] **Step 6.3: Write `src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  color-scheme: light;
  --bg: #f8fafc;
  --fg: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --accent: #2563eb;
}
html, body { background: var(--bg); color: var(--fg); }
```

- [ ] **Step 6.4: Update `src/app/layout.tsx`** to import `./globals.css` and drop the inline style:

```tsx
import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Partner',
  description: 'AI-powered referral platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 6.5: Verify build still works**

```bash
pnpm build
```
Expected: build completes; CSS is included in route.

- [ ] **Step 6.6: Commit**

```bash
git add postcss.config.mjs src/app/globals.css src/app/layout.tsx package.json pnpm-lock.yaml
git commit -m "feat(ui): tailwind v4 base styles"
```

---

## Task 7: Signup page + server action

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/(auth)/signup/actions.ts`

- [ ] **Step 7.1: Write `src/app/(auth)/layout.tsx`**

```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
        <Link href="/" className="mb-6 block text-center text-lg font-semibold">Partner</Link>
        {children}
      </div>
    </main>
  );
}
```

- [ ] **Step 7.2: Write `src/app/(auth)/signup/actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { ensureWorkspaceForUser } from '@/lib/workspaces/ensure';
import { headers } from 'next/headers';

export type SignupState = { error?: string };

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Email and password are required.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

  try {
    const res = await auth.api.signUpEmail({
      body: { email, password, name: email.split('@')[0] ?? email },
      headers: await headers(),
      returnHeaders: true,
    });
    if (!res.response?.user?.id) {
      return { error: 'Signup failed.' };
    }
    await ensureWorkspaceForUser(res.response.user.id, email);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Signup failed.';
    return { error: msg };
  }

  redirect('/app');
}
```

- [ ] **Step 7.3: Write `src/app/(auth)/signup/page.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signupAction, type SignupState } from './actions';

const initial: SignupState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Create account</h1>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Creating…' : 'Sign up'}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        Already have one? <Link className="underline" href="/login">Log in</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 7.4: Verify dev server renders the page**

```bash
pnpm dev > /tmp/next-dev.log 2>&1 &
sleep 8
curl -s http://localhost:3000/signup | grep -c 'Create account'
lsof -ti:3000 | xargs -r kill -9
```
Expected: `1`.

- [ ] **Step 7.5: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "feat(auth): signup page + server action with workspace bootstrap"
```

---

## Task 8: Login page + server action + logout

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/actions.ts`
- Create: `src/app/(dashboard)/app/actions.ts` (logoutAction goes here so the dashboard can call it)

- [ ] **Step 8.1: Write `src/app/(auth)/login/actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email and password are required.' };

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
      returnHeaders: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid email or password.';
    return { error: msg };
  }

  redirect('/app');
}
```

- [ ] **Step 8.2: Write `src/app/(auth)/login/page.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, type LoginState } from './actions';

const initial: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Log in</h1>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Logging in…' : 'Log in'}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        New here? <Link className="underline" href="/signup">Create an account</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 8.3: Verify the page renders**

```bash
pnpm dev > /tmp/next-dev.log 2>&1 &
sleep 8
curl -s http://localhost:3000/login | grep -c 'Log in'
lsof -ti:3000 | xargs -r kill -9
```
Expected: `1` (or more).

- [ ] **Step 8.4: Commit**

```bash
git add src/app/\(auth\)/login/
git commit -m "feat(auth): login page + server action"
```

---

## Task 9: Link queries (workspace-scoped CRUD)

**Files:**
- Create: `src/lib/links/queries.ts`
- Create: `tests/lib/links/queries.test.ts`

- [ ] **Step 9.1: Write the failing test `tests/lib/links/queries.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db, pool } from '@/db/client';
import { links, workspaces, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  listLinksForWorkspace,
  createLinkForWorkspace,
  updateLinkInWorkspace,
  deleteLinkInWorkspace,
} from '@/lib/links/queries';

const UID_A = 'test-user-a';
const UID_B = 'test-user-b';
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

  it('listLinksForWorkspace returns only that workspace\'s links', async () => {
    await createLinkForWorkspace(wsA, { slug: 'wq-a', destinationUrl: 'https://a' });
    await createLinkForWorkspace(wsB, { slug: 'wq-b', destinationUrl: 'https://b' });
    const aLinks = await listLinksForWorkspace(wsA);
    expect(aLinks.map((l) => l.slug)).toEqual(['wq-a']);
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
```

- [ ] **Step 9.2: Run, confirm RED**

```bash
pnpm test tests/lib/links/queries.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 9.3: Write `src/lib/links/queries.ts`**

```ts
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
  const patch: Record<string, string> = {};
  if (input.destinationUrl !== undefined) patch.destination_url = input.destinationUrl;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (Object.keys(patch).length === 0) {
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
```

- [ ] **Step 9.4: Run, confirm GREEN**

```bash
pnpm test tests/lib/links/queries.test.ts
```
Expected: 5 passing.

- [ ] **Step 9.5: Commit**

```bash
git add src/lib/links/queries.ts tests/lib/links/queries.test.ts
git commit -m "feat(links): workspace-scoped CRUD queries with cross-tenant guards"
```

---

## Task 10: Dashboard layout (auth gate) + sidebar

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/app/actions.ts` (logoutAction)

- [ ] **Step 10.1: Write `src/app/(dashboard)/app/actions.ts`** (link CRUD actions added in Task 11; this lands logout)

```ts
'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';

export async function logoutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect('/login');
}
```

- [ ] **Step 10.2: Write `src/app/(dashboard)/layout.tsx`**

```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ensureWorkspaceForUser } from '@/lib/workspaces/ensure';
import { logoutAction } from './app/actions';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  await ensureWorkspaceForUser(session.user.id, session.user.email);

  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr]">
      <aside className="border-r border-[var(--border)] bg-white p-4">
        <Link href="/app" className="block text-lg font-semibold">Partner</Link>
        <nav className="mt-6 flex flex-col gap-1 text-sm">
          <Link href="/app" className="rounded-md px-2 py-1 hover:bg-slate-100">Links</Link>
        </nav>
        <form action={logoutAction} className="mt-6">
          <button className="text-sm text-[var(--muted)] hover:text-[var(--fg)]">Log out</button>
        </form>
        <p className="mt-auto pt-8 text-xs text-[var(--muted)]">{session.user.email}</p>
      </aside>
      <main className="p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 10.3: Verify auth gate redirects**

```bash
pnpm dev > /tmp/next-dev.log 2>&1 &
sleep 8
curl -sI http://localhost:3000/app | head -3
lsof -ti:3000 | xargs -r kill -9
```
Expected: 307 or 302 redirect to /login.

- [ ] **Step 10.4: Commit**

```bash
git add src/app/\(dashboard\)/
git commit -m "feat(dashboard): auth-gated layout with sidebar + logout"
```

---

## Task 11: Links list page + create form + actions

**Files:**
- Create: `src/app/(dashboard)/app/page.tsx`
- Create: `src/app/(dashboard)/app/new/page.tsx`
- Modify: `src/app/(dashboard)/app/actions.ts` (add createLinkAction)

- [ ] **Step 11.1: Append `createLinkAction` to `src/app/(dashboard)/app/actions.ts`**

Add the function below to the existing file. **Merge** the new imports into the existing import block at the top — do not duplicate `redirect` or `headers` or `auth`, which are already imported from Task 10.1.

```ts
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { workspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createLinkForWorkspace } from '@/lib/links/queries';
import { getSession } from '@/lib/auth/session';

export type CreateLinkState = { error?: string };

export async function createLinkAction(
  _prev: CreateLinkState,
  formData: FormData,
): Promise<CreateLinkState> {
  const session = await getSession();
  if (!session) redirect('/login');

  const slug = String(formData.get('slug') ?? '').trim();
  const destinationUrl = String(formData.get('destinationUrl') ?? '').trim();
  if (!slug || !destinationUrl) return { error: 'Slug and destination are required.' };
  if (!/^[a-z0-9-]{2,40}$/i.test(slug)) {
    return { error: 'Slug must be 2–40 chars: letters, numbers, hyphens.' };
  }
  try {
    new URL(destinationUrl);
  } catch {
    return { error: 'Destination must be a valid absolute URL.' };
  }

  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, session.user.id))
    .limit(1);
  if (!ws) return { error: 'Workspace missing.' };

  try {
    await createLinkForWorkspace(ws.id, { slug, destinationUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not create link.';
    if (msg.includes('unique')) return { error: 'That slug is already taken.' };
    return { error: msg };
  }

  revalidatePath('/app');
  redirect('/app');
}
```

- [ ] **Step 11.2: Write `src/app/(dashboard)/app/page.tsx`**

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { workspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { listLinksForWorkspace } from '@/lib/links/queries';

export const dynamic = 'force-dynamic';

export default async function LinksListPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, session.user.id))
    .limit(1);
  if (!ws) redirect('/login');

  const rows = await listLinksForWorkspace(ws.id);
  const shortDomain = process.env.SHORT_DOMAIN ?? 'partner.711web.com';

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Links</h1>
        <Link
          href="/app/new"
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
        >
          New link
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
          No links yet — create your first one.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)] rounded-md border border-[var(--border)] bg-white">
          {rows.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">
                  https://{shortDomain}/go/{l.slug}
                </div>
                <div className="truncate text-xs text-[var(--muted)]">{l.destinationUrl}</div>
              </div>
              <div className="ml-4 flex items-center gap-4">
                <span className="text-xs text-[var(--muted)]">
                  {l.clickCount} click{l.clickCount === 1 ? '' : 's'}
                </span>
                <Link href={`/app/${l.id}/edit`} className="text-xs underline">
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 11.3: Write `src/app/(dashboard)/app/new/page.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createLinkAction, type CreateLinkState } from '../actions';

const initial: CreateLinkState = {};

export default function NewLinkPage() {
  const [state, formAction, pending] = useActionState(createLinkAction, initial);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">New link</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Slug
          <input
            name="slug"
            required
            pattern="[A-Za-z0-9\-]{2,40}"
            placeholder="my-promo"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Destination URL
          <input
            name="destinationUrl"
            type="url"
            required
            placeholder="https://example.com/landing"
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Creating…' : 'Create'}
          </button>
          <Link
            href="/app"
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 11.4: Manual smoke**

```bash
pnpm dev > /tmp/next-dev.log 2>&1 &
sleep 8
# Sign up via curl using Better-Auth's API, then list links cookie-handshake style
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{"email":"smoke@example.com","password":"smokepass123","name":"smoke"}' | head -c 200
echo ""
# Hit /app with the cookie
curl -s -b /tmp/cookies.txt http://localhost:3000/app | grep -c 'Links'
lsof -ti:3000 | xargs -r kill -9
```
Expected: Signup returns a JSON body with `user`. The follow-up GET to `/app` contains "Links" (the page title).

- [ ] **Step 11.5: Commit**

```bash
git add src/app/\(dashboard\)/
git commit -m "feat(dashboard): links list + new-link form + createLinkAction"
```

---

## Task 12: Edit + delete

**Files:**
- Create: `src/app/(dashboard)/app/[id]/edit/page.tsx`
- Modify: `src/app/(dashboard)/app/actions.ts` (add updateLinkAction + deleteLinkAction)

- [ ] **Step 12.1: Append to `src/app/(dashboard)/app/actions.ts`**

Merge the import for `getLinkByIdInWorkspace, updateLinkInWorkspace, deleteLinkInWorkspace` into the existing import from `@/lib/links/queries` at the top of the file (Task 11.1 already imported `createLinkForWorkspace` from that module). All other imports (`getSession`, `redirect`, `db`, `workspaces`, `eq`, `revalidatePath`) are already present.

```ts
import { getLinkByIdInWorkspace, updateLinkInWorkspace, deleteLinkInWorkspace } from '@/lib/links/queries';

export type UpdateLinkState = { error?: string };

export async function updateLinkAction(
  _prev: UpdateLinkState,
  formData: FormData,
): Promise<UpdateLinkState> {
  const session = await getSession();
  if (!session) redirect('/login');
  const id = String(formData.get('id') ?? '');
  const destinationUrl = String(formData.get('destinationUrl') ?? '').trim();
  if (!id || !destinationUrl) return { error: 'Missing fields.' };
  try { new URL(destinationUrl); } catch { return { error: 'Destination must be a valid URL.' }; }

  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, session.user.id))
    .limit(1);
  if (!ws) return { error: 'Workspace missing.' };

  const row = await updateLinkInWorkspace(id, ws.id, { destinationUrl });
  if (!row) return { error: 'Not found.' };
  revalidatePath('/app');
  redirect('/app');
}

export async function deleteLinkAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/app');

  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, session.user.id))
    .limit(1);
  if (!ws) redirect('/app');

  await deleteLinkInWorkspace(id, ws.id);
  revalidatePath('/app');
  redirect('/app');
}
```

- [ ] **Step 12.2: Write `src/app/(dashboard)/app/[id]/edit/page.tsx`**

```tsx
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/db/client';
import { workspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { getLinkByIdInWorkspace } from '@/lib/links/queries';
import { EditLinkForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, session.user.id))
    .limit(1);
  if (!ws) redirect('/login');
  const link = await getLinkByIdInWorkspace(id, ws.id);
  if (!link) notFound();

  return (
    <div className="mx-auto max-w-md">
      <Link href="/app" className="mb-4 inline-block text-sm text-[var(--muted)]">← Back</Link>
      <h1 className="mb-6 text-2xl font-semibold">Edit link</h1>
      <EditLinkForm id={link.id} slug={link.slug} destinationUrl={link.destinationUrl} />
    </div>
  );
}
```

And the client form `src/app/(dashboard)/app/[id]/edit/edit-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { updateLinkAction, deleteLinkAction, type UpdateLinkState } from '../../actions';

const initial: UpdateLinkState = {};

export function EditLinkForm(props: { id: string; slug: string; destinationUrl: string }) {
  const [state, formAction, pending] = useActionState(updateLinkAction, initial);
  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={props.id} />
        <label className="flex flex-col gap-1 text-sm">
          Slug
          <input
            disabled
            value={props.slug}
            className="rounded-md border border-[var(--border)] bg-slate-50 px-3 py-2 text-[var(--muted)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Destination URL
          <input
            name="destinationUrl"
            type="url"
            required
            defaultValue={props.destinationUrl}
            className="rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>
      <form action={deleteLinkAction}>
        <input type="hidden" name="id" value={props.id} />
        <button
          type="submit"
          onClick={(e) => {
            if (!confirm('Delete this link? Click history will be removed.')) e.preventDefault();
          }}
          className="text-sm text-red-600 underline"
        >
          Delete link
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 12.3: Commit**

```bash
git add src/app/\(dashboard\)/
git commit -m "feat(dashboard): edit + delete link with workspace guards"
```

---

## Task 13: Landing page update + auth smoke (Playwright)

**Files:**
- Modify: `src/app/page.tsx`
- Create: `tests/app/auth.smoke.test.ts`

- [ ] **Step 13.1: Update `src/app/page.tsx`**

```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Partner</h1>
      <p className="max-w-md text-[var(--muted)]">
        Short-link tracking for creators and brands. AI-powered campaigns coming soon.
      </p>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 13.2: Write `tests/app/auth.smoke.test.ts`**

```ts
import { test, expect } from '@playwright/test';

test('signup → create link → see in list → logout', async ({ page, baseURL }) => {
  const email = `smoke+${Date.now()}@example.com`;
  const slug = `smk-${Date.now().toString(36)}`;

  // Signup
  await page.goto(`${baseURL}/signup`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('smokepass123');
  await page.getByRole('button', { name: /sign up/i }).click();
  await page.waitForURL('**/app');

  await expect(page.getByRole('heading', { name: 'Links' })).toBeVisible();

  // Create link
  await page.getByRole('link', { name: /new link/i }).click();
  await page.getByLabel('Slug').fill(slug);
  await page.getByLabel('Destination URL').fill('https://example.com/smoke');
  await page.getByRole('button', { name: /create/i }).click();
  await page.waitForURL('**/app');

  await expect(page.locator(`text=${slug}`)).toBeVisible();

  // Logout
  await page.getByRole('button', { name: /log out/i }).click();
  await page.waitForURL('**/login');
});
```

- [ ] **Step 13.3: Run the full smoke suite locally**

```bash
lsof -ti:3000 | xargs -r kill -9 2>/dev/null || true
pnpm test:smoke
```
Expected: 3 tests passing (slice-1 redirect + 404 + new auth flow).

- [ ] **Step 13.4: Commit**

```bash
git add src/app/page.tsx tests/app/auth.smoke.test.ts
git commit -m "feat(app): landing + Playwright auth flow smoke"
```

---

## Task 14: Bootstrap script — generate AUTH_SECRET on prod

**Files:**
- Modify: `deploy/scripts/bootstrap-server.sh`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 14.1: Edit `deploy/scripts/bootstrap-server.sh`** — find the `# 4. Write .env` block and update the heredoc to add `AUTH_SECRET`. Replace this section:

```bash
# 4. Write .env
echo ">> writing $ENV_FILE"
cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgres://referral:${EFFECTIVE_PW}@localhost:5432/referral
REDIS_URL=redis://localhost:6379
SHORT_DOMAIN=partner.711web.com
NODE_ENV=production
PORT=${APP_PORT}
EOF
chmod 600 "$ENV_FILE"
```

with:

```bash
# 4. Write .env (preserve AUTH_SECRET if it exists; generate if missing)
echo ">> writing $ENV_FILE"
EXISTING_AUTH_SECRET=$(grep -E '^AUTH_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
if [ -z "$EXISTING_AUTH_SECRET" ]; then
  EXISTING_AUTH_SECRET=$(openssl rand -base64 32)
fi
cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgres://referral:${EFFECTIVE_PW}@localhost:5432/referral
REDIS_URL=redis://localhost:6379
SHORT_DOMAIN=partner.711web.com
NODE_ENV=production
PORT=${APP_PORT}
AUTH_SECRET=${EXISTING_AUTH_SECRET}
EOF
chmod 600 "$ENV_FILE"
```

- [ ] **Step 14.2: Edit `.github/workflows/deploy.yml`** — add `AUTH_SECRET` to the test job env so CI doesn't fail on missing secret. Add this line under the `env:` block of the `test` job:

```yaml
      AUTH_SECRET: ci-only-not-secret-32-chars-abcdefghij
```

- [ ] **Step 14.3: Commit**

```bash
git add deploy/scripts/bootstrap-server.sh .github/workflows/deploy.yml
git commit -m "infra: generate AUTH_SECRET in .env on bootstrap; static CI value"
```

---

## Task 15: Production deploy + verify

**Files:** none — operational.

- [ ] **Step 15.1: Push to main**

```bash
git push
```

GitHub Actions runs test → ssh deploy → smoke automatically.

- [ ] **Step 15.2: SSH and verify AUTH_SECRET landed in .env**

```bash
ssh -i ~/.ssh/partner-uk-ec2 ubuntu@18.134.35.3 \
  "bash /srv/referral-platform/deploy/scripts/bootstrap-server.sh 2>&1 | tail -3 && grep AUTH_SECRET /srv/referral-platform/.env | cut -d= -f1"
```

Expected: `Bootstrap complete.` and `AUTH_SECRET`.

- [ ] **Step 15.3: Force a re-deploy (pm2 restart) to pick up new env**

```bash
ssh -i ~/.ssh/partner-uk-ec2 ubuntu@18.134.35.3 \
  "cd /srv/referral-platform && bash deploy/scripts/deploy.sh 2>&1 | tail -5"
```

- [ ] **Step 15.4: End-to-end smoke against prod**

```bash
# Auth flow only — slice 1 paths still tested by existing smoke
SMOKE_BASE_URL=https://partner.711web.com pnpm test:smoke
```
Expected: 3 tests passing.

- [ ] **Step 15.5: Visual confirmation**

Open `https://partner.711web.com/signup` in a browser, create a real account, create a link, verify it appears, hit `https://partner.711web.com/go/<your-slug>` and confirm 302 + click logged.

---

## Slice 2 — Done Criteria

- [ ] `users`, `sessions`, `accounts`, `verifications`, `workspaces` tables exist in local + prod
- [ ] Existing `links` rows backfilled into the `system` workspace; `links.workspace_id` is NOT NULL with FK
- [ ] `https://partner.711web.com/signup` accepts a new user; workspace auto-created
- [ ] `https://partner.711web.com/login` resumes session
- [ ] `/app` shows the user's own links + click counts; create + edit + delete all enforce workspace ownership (cross-tenant access returns null)
- [ ] Logout returns to `/login`
- [ ] Slice 1 `/go/:slug` still works for any seeded or user-created link
- [ ] Playwright smoke (3 tests) green against prod
- [ ] Auto-deploy on push to main still green

When all bullets are checked, Slice 2 is done and Slice 3 (conversion attribution) can start.

---

## What's deliberately NOT in this slice

- Email verification (deferred — trust the email at signup)
- Password reset / forgot-password (deferred — manual recovery only)
- OAuth providers (deferred to Slice 5 alongside AI; Better-Auth makes them trivial to add)
- Multi-workspace UI (deferred to Slice 4 when teams/campaigns matter)
- Rate limiting on auth endpoints (Better-Auth has built-in but tuning waits)
- Avatar / profile editing
- 2FA
- Slug uniqueness preview ("this slug is taken" check while typing)
- Pagination on links list (works fine until ~1000 rows; tackle when needed)
- Pretty error pages (using Next defaults until Slice 5's UI polish pass)
