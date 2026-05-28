import { pgTable, text, timestamp, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: text('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['creator', 'brand', 'system'] }).notNull().default('creator'),
    // Brand HMAC credentials (set when first needed for conversion attribution).
    // `brandKey` is public (sent in X-Brand-Key header), `brandSecret` HMAC-signs the body.
    brandKey: text('brand_key'),
    brandSecret: text('brand_secret'),
    // AI credits (Slice 5). Pre-paid, decremented per AI call.
    aiCredits: text('ai_credits').notNull().default('0'),
    // Brand tags (Slice 4) for matching. Comma-separated for simplicity.
    tags: text('tags').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index('workspaces_owner_idx').on(t.ownerUserId),
    brandKeyUniq: uniqueIndex('workspaces_brand_key_uniq').on(t.brandKey),
  }),
);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
