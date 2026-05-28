import { pgTable, text, timestamp, uuid, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { links } from './links';
import { workspaces } from './workspaces';

/**
 * A conversion is a sale/signup/event reported by the brand against a click.
 * `clickIdCookie` is the ULID we set in the `_clid` cookie at /go/:slug.
 * Idempotent by (brandWorkspaceId, externalOrderId).
 */
export const conversions = pgTable(
  'conversions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clickIdCookie: text('click_id_cookie').notNull(),
    linkId: uuid('link_id').references(() => links.id, { onDelete: 'set null' }),
    creatorWorkspaceId: uuid('creator_workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    brandWorkspaceId: uuid('brand_workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // amount in minor units (cents). Currency 3-letter code.
    amountCents: integer('amount_cents').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    externalOrderId: text('external_order_id'),
    source: text('source', { enum: ['webhook', 'pixel'] }).notNull(),
    status: text('status', { enum: ['pending', 'approved', 'reversed'] })
      .notNull()
      .default('pending'),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clickIdx: index('conversions_click_idx').on(t.clickIdCookie),
    brandIdx: index('conversions_brand_idx').on(t.brandWorkspaceId, t.ts),
    creatorIdx: index('conversions_creator_idx').on(t.creatorWorkspaceId, t.ts),
    // Idempotency: same brand + external order id = same conversion
    extOrderUniq: uniqueIndex('conversions_brand_external_order_uniq').on(
      t.brandWorkspaceId,
      t.externalOrderId,
    ),
  }),
);

export type Conversion = typeof conversions.$inferSelect;
export type NewConversion = typeof conversions.$inferInsert;

/**
 * Commission row: the creator earned X cents off the brand's commission_pct
 * applied to the conversion amount. Mirrors Stripe Connect's transfer-intent model.
 */
export const commissions = pgTable(
  'commissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversionId: uuid('conversion_id')
      .notNull()
      .references(() => conversions.id, { onDelete: 'cascade' }),
    creatorWorkspaceId: uuid('creator_workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    brandWorkspaceId: uuid('brand_workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    status: text('status', { enum: ['accrued', 'approved', 'paid', 'reversed'] })
      .notNull()
      .default('accrued'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (t) => ({
    creatorIdx: index('commissions_creator_idx').on(t.creatorWorkspaceId, t.createdAt),
    brandIdx: index('commissions_brand_idx').on(t.brandWorkspaceId, t.createdAt),
  }),
);

export type Commission = typeof commissions.$inferSelect;
export type NewCommission = typeof commissions.$inferInsert;
