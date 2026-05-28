CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"credit_cost" integer DEFAULT 1 NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"credits" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"stripe_session_id" text,
	"stripe_invoice_id" text,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_packs_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "ai_credits" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "ai_credits" SET DATA TYPE integer USING ai_credits::integer;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "ai_credits" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_packs" ADD CONSTRAINT "credit_packs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_workspace_idx" ON "ai_usage" USING btree ("workspace_id","ts");--> statement-breakpoint
CREATE INDEX "credit_packs_workspace_idx" ON "credit_packs" USING btree ("workspace_id","purchased_at");