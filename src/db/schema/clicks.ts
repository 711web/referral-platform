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
