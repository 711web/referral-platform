CREATE TABLE "campaign_creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"creator_workspace_id" uuid NOT NULL,
	"tracking_link_id" uuid,
	"status" text DEFAULT 'joined' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"landing_url" text NOT NULL,
	"commission_bps" integer DEFAULT 1000 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "campaign_creators" ADD CONSTRAINT "campaign_creators_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_creators" ADD CONSTRAINT "campaign_creators_creator_workspace_id_workspaces_id_fk" FOREIGN KEY ("creator_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_creators" ADD CONSTRAINT "campaign_creators_tracking_link_id_links_id_fk" FOREIGN KEY ("tracking_link_id") REFERENCES "public"."links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_workspace_id_workspaces_id_fk" FOREIGN KEY ("brand_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_creators_uniq" ON "campaign_creators" USING btree ("campaign_id","creator_workspace_id");--> statement-breakpoint
CREATE INDEX "campaign_creators_creator_idx" ON "campaign_creators" USING btree ("creator_workspace_id");--> statement-breakpoint
CREATE INDEX "campaigns_brand_idx" ON "campaigns" USING btree ("brand_workspace_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "links_workspace_idx" ON "links" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "links_campaign_idx" ON "links" USING btree ("campaign_id");