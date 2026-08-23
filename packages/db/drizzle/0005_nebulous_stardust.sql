CREATE TYPE "public"."appointment_series_status" AS ENUM('activa', 'completada', 'cancelada');--> statement-breakpoint
CREATE TABLE "appointment_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"doctor_id" uuid,
	"titulo" text NOT NULL,
	"frecuencia" text DEFAULT 'semanal' NOT NULL,
	"hora_ini" time NOT NULL,
	"total_sesiones" integer NOT NULL,
	"creadas" integer DEFAULT 0 NOT NULL,
	"omitidas" integer DEFAULT 0 NOT NULL,
	"estado" "appointment_series_status" DEFAULT 'activa' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_signs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"template_id" uuid,
	"tratamiento" text,
	"contenido_snap" text NOT NULL,
	"firmante_nombre" text NOT NULL,
	"firmante_rol" text DEFAULT 'paciente' NOT NULL,
	"signature_data" text,
	"signature_sha256" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"registrado_por" uuid,
	"attachment_id" uuid,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tratamiento" text,
	"contenido" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_templates_tenant_nombre_key" UNIQUE("tenant_id","nombre")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "series_n" integer;--> statement-breakpoint
ALTER TABLE "patient_magic_tokens" ADD COLUMN "tipo" text DEFAULT 'portal' NOT NULL;--> statement-breakpoint
ALTER TABLE "patient_magic_tokens" ADD COLUMN "used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "representante_id" uuid;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "instrucciones_pre" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "instrucciones_post" text;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signs" ADD CONSTRAINT "consent_signs_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signs" ADD CONSTRAINT "consent_signs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signs" ADD CONSTRAINT "consent_signs_template_id_consent_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."consent_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signs" ADD CONSTRAINT "consent_signs_registrado_por_users_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signs" ADD CONSTRAINT "consent_signs_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_series_tenant_idx" ON "appointment_series" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "appointment_series_patient_idx" ON "appointment_series" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "consent_signs_patient_idx" ON "consent_signs" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "consent_signs_tenant_idx" ON "consent_signs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "consent_templates_tenant_idx" ON "consent_templates" USING btree ("tenant_id");