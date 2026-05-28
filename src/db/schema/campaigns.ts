import { pgTable, text, timestamp, uuid, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { links } from './links';

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    brandWorkspaceId: uuid('brand_workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    brief: text('brief').notNull().default(''),
    landingUrl: text('landing_url').notNull(),
    // Commission rate in basis points (1000 = 10.00%). Overrides default.
    commissionBps: integer('commission_bps').notNull().default(1000),
    currency: text('currency').notNull().default('USD'),
    status: text('status', { enum: ['draft', 'live', 'paused', 'ended'] })
      .notNull()
      .default('draft'),
    // Comma-separated tags for matching (Slice 6)
    tags: text('tags').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandIdx: index('campaigns_brand_idx').on(t.brandWorkspaceId),
    statusIdx: index('campaigns_status_idx').on(t.status),
  }),
);

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;

/**
 * A creator can join a brand's campaign. When they do, we mint a per-creator
 * tracking link (`links` row pointing to the campaign landing_url, with the
 * link's workspace set to the creator workspace so click/commission attribution
 * threads through).
 */
export const campaignCreators = pgTable(
  'campaign_creators',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    creatorWorkspaceId: uuid('creator_workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    trackingLinkId: uuid('tracking_link_id').references(() => links.id, {
      onDelete: 'set null',
    }),
    status: text('status', { enum: ['invited', 'joined', 'removed'] })
      .notNull()
      .default('joined'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('campaign_creators_uniq').on(t.campaignId, t.creatorWorkspaceId),
    creatorIdx: index('campaign_creators_creator_idx').on(t.creatorWorkspaceId),
  }),
);

export type CampaignCreator = typeof campaignCreators.$inferSelect;
export type NewCampaignCreator = typeof campaignCreators.$inferInsert;
