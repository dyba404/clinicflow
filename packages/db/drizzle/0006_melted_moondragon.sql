CREATE TYPE "public"."treatment_plan_item_status" AS ENUM('pending', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."treatment_plan_session_status" AS ENUM('programada', 'realizada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."treatment_plan_status" AS ENUM('draft', 'pending', 'active', 'completed', 'archived', 'closed');--> statement-breakpoint
CREATE TABLE "treatment_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"secuencia" integer DEFAULT 1 NOT NULL,
	"estado" "treatment_plan_item_status" DEFAULT 'pending' NOT NULL,
	"snapshot_servicio" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatment_plan_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"session_n" integer DEFAULT 1 NOT NULL,
	"appointment_id" uuid,
	"estado" "treatment_plan_session_status" DEFAULT 'programada' NOT NULL,
	"realizada_at" timestamp with time zone,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"plan_number" text NOT NULL,
	"estado" "treatment_plan_status" DEFAULT 'draft' NOT NULL,
	"closure_reason" text,
	"titulo" text NOT NULL,
	"budget_id" uuid,
	"assigned_doctor_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treatment_plans_tenant_plan_number_key" UNIQUE("tenant_id","plan_number")
);
--> statement-breakpoint
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_plan_id_treatment_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."treatment_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_sessions" ADD CONSTRAINT "treatment_plan_sessions_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_sessions" ADD CONSTRAINT "treatment_plan_sessions_item_id_treatment_plan_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."treatment_plan_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_sessions" ADD CONSTRAINT "treatment_plan_sessions_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_budget_id_quotes_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_assigned_doctor_id_memberships_id_fk" FOREIGN KEY ("assigned_doctor_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treatment_plan_items_plan_idx" ON "treatment_plan_items" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "treatment_plan_items_tenant_idx" ON "treatment_plan_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "treatment_plan_sessions_item_idx" ON "treatment_plan_sessions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "treatment_plan_sessions_tenant_idx" ON "treatment_plan_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "treatment_plans_patient_idx" ON "treatment_plans" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "treatment_plans_tenant_idx" ON "treatment_plans" USING btree ("tenant_id");