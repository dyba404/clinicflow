CREATE TYPE "public"."admission_status" AS ENUM('activa', 'egresada', 'abandono');--> statement-breakpoint
CREATE TYPE "public"."admission_type" AS ENUM('emergencia', 'observacion', 'internamiento');--> statement-breakpoint
CREATE TYPE "public"."bed_state" AS ENUM('libre', 'ocupada', 'limpieza', 'bloqueada');--> statement-breakpoint
CREATE TYPE "public"."bed_type" AS ENUM('cama', 'sillon', 'aislamiento');--> statement-breakpoint
CREATE TYPE "public"."discharge_type" AS ENUM('medica', 'voluntaria');--> statement-breakpoint
CREATE TYPE "public"."vital_signs_turn" AS ENUM('manana', 'tarde', 'noche');--> statement-breakpoint
CREATE TABLE "admissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"consultation_id" uuid,
	"tipo" "admission_type" DEFAULT 'internamiento' NOT NULL,
	"motivo" text NOT NULL,
	"estado" "admission_status" DEFAULT 'activa' NOT NULL,
	"admitted_by_id" uuid,
	"admitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"discharged_at" timestamp with time zone,
	"alta_tipo" "discharge_type",
	"epicrisis" text
);
--> statement-breakpoint
CREATE TABLE "bed_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admission_id" uuid NOT NULL,
	"bed_id" uuid NOT NULL,
	"motivo" text,
	"desde" timestamp with time zone DEFAULT now() NOT NULL,
	"hasta" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "beds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"area" text,
	"tipo" "bed_type" DEFAULT 'cama' NOT NULL,
	"estado" "bed_state" DEFAULT 'libre' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispensations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid,
	"order_id" uuid,
	"prescription_id" uuid,
	"item_id" uuid NOT NULL,
	"lot_id" uuid,
	"cantidad" numeric(12, 2) NOT NULL,
	"dispensado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"admission_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"nota" text NOT NULL,
	"doctor_membership_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"parametro" text NOT NULL,
	"valor_text" text,
	"valor_num" numeric(18, 6),
	"unidad" text,
	"referencia" text,
	"flag" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vital_signs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"admission_id" uuid NOT NULL,
	"turno" "vital_signs_turn" NOT NULL,
	"pa_sistolica" integer,
	"pa_diastolica" integer,
	"temperatura" numeric(4, 1),
	"fc" integer,
	"fr" integer,
	"spo2" integer,
	"nota" text,
	"registrado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_admitted_by_id_users_id_fk" FOREIGN KEY ("admitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bed_assignments" ADD CONSTRAINT "bed_assignments_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bed_assignments" ADD CONSTRAINT "bed_assignments_bed_id_beds_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."beds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beds" ADD CONSTRAINT "beds_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensations" ADD CONSTRAINT "dispensations_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensations" ADD CONSTRAINT "dispensations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensations" ADD CONSTRAINT "dispensations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensations" ADD CONSTRAINT "dispensations_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensations" ADD CONSTRAINT "dispensations_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensations" ADD CONSTRAINT "dispensations_lot_id_inventory_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensations" ADD CONSTRAINT "dispensations_dispensado_por_users_id_fk" FOREIGN KEY ("dispensado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolutions" ADD CONSTRAINT "evolutions_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolutions" ADD CONSTRAINT "evolutions_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolutions" ADD CONSTRAINT "evolutions_doctor_membership_id_memberships_id_fk" FOREIGN KEY ("doctor_membership_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolutions" ADD CONSTRAINT "evolutions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_results" ADD CONSTRAINT "order_results_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_registrado_por_users_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admissions_tenant_estado_idx" ON "admissions" USING btree ("tenant_id","estado");--> statement-breakpoint
CREATE INDEX "admissions_patient_idx" ON "admissions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "bed_assignments_admission_idx" ON "bed_assignments" USING btree ("admission_id");--> statement-breakpoint
CREATE INDEX "bed_assignments_bed_idx" ON "bed_assignments" USING btree ("bed_id");--> statement-breakpoint
CREATE UNIQUE INDEX "beds_tenant_nombre_idx" ON "beds" USING btree ("tenant_id","nombre");--> statement-breakpoint
CREATE INDEX "dispensations_tenant_idx" ON "dispensations" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "dispensations_order_idx" ON "dispensations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "evolutions_admission_idx" ON "evolutions" USING btree ("admission_id");--> statement-breakpoint
CREATE INDEX "order_results_order_idx" ON "order_results" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "vital_signs_admission_idx" ON "vital_signs" USING btree ("admission_id");--> statement-breakpoint
CREATE INDEX "vital_signs_tenant_created_idx" ON "vital_signs" USING btree ("tenant_id","created_at");