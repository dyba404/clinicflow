CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"nombre" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holidays_tenant_fecha_key" UNIQUE("tenant_id","fecha")
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "round_robin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "holidays_tenant_idx" ON "holidays" USING btree ("tenant_id");