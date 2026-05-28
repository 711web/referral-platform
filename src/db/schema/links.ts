import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const links = pgTable(
  'links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    destinationUrl: text('destination_url').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: index('links_slug_idx').on(t.slug),
  }),
);

export type Link = typeof links.$inferSelect;
