CREATE TYPE "public"."invoice_status" AS ENUM('borrador', 'emitida', 'pagada', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."surgery_status" AS ENUM('programada', 'intra', 'urpa', 'completada', 'cancelada');--> statement-breakpoint
CREATE TABLE "convenios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"descuento_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icu_stays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"admission_id" uuid,
	"ingreso_at" timestamp with time zone DEFAULT now() NOT NULL,
	"egreso_at" timestamp with time zone,
	"balance_hidrico" jsonb,
	"notas" text,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"convenio_id" uuid,
	"admission_id" uuid,
	"items" jsonb NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"estado" "invoice_status" DEFAULT 'borrador' NOT NULL,
	"emitida_at" timestamp with time zone,
	"pagada_at" timestamp with time zone,
	"anulada_motivo" text,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surgeries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"admission_id" uuid,
	"appointment_id" uuid,
	"room_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"procedimiento" text NOT NULL,
	"cirujano_membership_id" uuid,
	"anestesiologo_membership_id" uuid,
	"asa_clase" text,
	"estado" "surgery_status" DEFAULT 'programada' NOT NULL,
	"checklist_preop" jsonb,
	"anestesia_tipo" text,
	"anestesia_notas" text,
	"inicio_at" timestamp with time zone,
	"fin_at" timestamp with time zone,
	"equipo" jsonb,
	"complicaciones" text,
	"urpa_notas" text,
	"cancelada_motivo" text,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surgery_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "convenios" ADD CONSTRAINT "convenios_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenios" ADD CONSTRAINT "convenios_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icu_stays" ADD CONSTRAINT "icu_stays_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icu_stays" ADD CONSTRAINT "icu_stays_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icu_stays" ADD CONSTRAINT "icu_stays_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icu_stays" ADD CONSTRAINT "icu_stays_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_convenio_id_convenios_id_fk" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgeries" ADD CONSTRAINT "surgeries_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgeries" ADD CONSTRAINT "surgeries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgeries" ADD CONSTRAINT "surgeries_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgeries" ADD CONSTRAINT "surgeries_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgeries" ADD CONSTRAINT "surgeries_room_id_surgery_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."surgery_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgeries" ADD CONSTRAINT "surgeries_cirujano_membership_id_memberships_id_fk" FOREIGN KEY ("cirujano_membership_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgeries" ADD CONSTRAINT "surgeries_anestesiologo_membership_id_memberships_id_fk" FOREIGN KEY ("anestesiologo_membership_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgeries" ADD CONSTRAINT "surgeries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgery_rooms" ADD CONSTRAINT "surgery_rooms_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "convenios_tenant_idx" ON "convenios" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "icu_stays_tenant_idx" ON "icu_stays" USING btree ("tenant_id","ingreso_at");--> statement-breakpoint
CREATE INDEX "invoices_tenant_estado_idx" ON "invoices" USING btree ("tenant_id","estado");--> statement-breakpoint
CREATE INDEX "invoices_patient_idx" ON "invoices" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "surgeries_tenant_estado_idx" ON "surgeries" USING btree ("tenant_id","estado");--> statement-breakpoint
CREATE INDEX "surgeries_room_fecha_idx" ON "surgeries" USING btree ("room_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "surgery_rooms_tenant_nombre_idx" ON "surgery_rooms" USING btree ("tenant_id","nombre");