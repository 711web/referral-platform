CREATE TABLE IF NOT EXISTS "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"destination_url" text NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"country" text,
	"device" text,
	"referrer" text,
	"click_id_cookie" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clicks" ADD CONSTRAINT "clicks_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "links_slug_idx" ON "links" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clicks_link_ts_idx" ON "clicks" USING btree ("link_id","ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clicks_click_id_idx" ON "clicks" USING btree ("click_id_cookie");