import { pgTable, text, timestamp, uuid, integer, index } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

/**
 * Each row represents a one-time Stripe credit-pack purchase. The remaining
 * balance is the sum over all packs for a workspace minus ai_usage entries.
 * For simplicity Slice 5 uses workspaces.ai_credits as a running balance
 * (decremented per AI call), with this table as the audit log of purchases.
 */
export const creditPacks = pgTable(
  'credit_packs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    credits: integer('credits').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    stripeSessionId: text('stripe_session_id').unique(),
    stripeInvoiceId: text('stripe_invoice_id'),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('credit_packs_workspace_idx').on(t.workspaceId, t.purchasedAt),
  }),
);

export type CreditPack = typeof creditPacks.$inferSelect;
export type NewCreditPack = typeof creditPacks.$inferInsert;

/** Audit row per AI call. credit_cost is the # of credits decremented. */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    feature: text('feature').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    creditCost: integer('credit_cost').notNull().default(1),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('ai_usage_workspace_idx').on(t.workspaceId, t.ts),
  }),
);

export type AiUsage = typeof aiUsage.$inferSelect;
export type NewAiUsage = typeof aiUsage.$inferInsert;
