CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversion_id" uuid NOT NULL,
	"creator_workspace_id" uuid NOT NULL,
	"brand_workspace_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'accrued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"click_id_cookie" text NOT NULL,
	"link_id" uuid,
	"creator_workspace_id" uuid,
	"brand_workspace_id" uuid NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"external_order_id" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "brand_key" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "brand_secret" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "ai_credits" text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "tags" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_conversion_id_conversions_id_fk" FOREIGN KEY ("conversion_id") REFERENCES "public"."conversions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_creator_workspace_id_workspaces_id_fk" FOREIGN KEY ("creator_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_brand_workspace_id_workspaces_id_fk" FOREIGN KEY ("brand_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_creator_workspace_id_workspaces_id_fk" FOREIGN KEY ("creator_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_brand_workspace_id_workspaces_id_fk" FOREIGN KEY ("brand_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commissions_creator_idx" ON "commissions" USING btree ("creator_workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "commissions_brand_idx" ON "commissions" USING btree ("brand_workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "conversions_click_idx" ON "conversions" USING btree ("click_id_cookie");--> statement-breakpoint
CREATE INDEX "conversions_brand_idx" ON "conversions" USING btree ("brand_workspace_id","ts");--> statement-breakpoint
CREATE INDEX "conversions_creator_idx" ON "conversions" USING btree ("creator_workspace_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "conversions_brand_external_order_uniq" ON "conversions" USING btree ("brand_workspace_id","external_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_brand_key_uniq" ON "workspaces" USING btree ("brand_key");