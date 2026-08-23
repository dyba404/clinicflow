CREATE TYPE "public"."prescription_status" AS ENUM('emitida', 'anulada');--> statement-breakpoint
CREATE TABLE "patient_otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
ALTER TABLE "consult_diagnoses" ADD COLUMN "oculto_portal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "publicado_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "publicado_por" uuid;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "publicar_nota" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "despublicada_motivo" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "estado" "prescription_status" DEFAULT 'emitida' NOT NULL;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "anulada_por" uuid;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "anulada_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "anulada_motivo" text;--> statement-breakpoint
ALTER TABLE "patient_otp_codes" ADD CONSTRAINT "patient_otp_codes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_sessions" ADD CONSTRAINT "patient_sessions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_sessions" ADD CONSTRAINT "patient_sessions_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_otp_codes_patient_idx" ON "patient_otp_codes" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "patient_sessions_patient_idx" ON "patient_sessions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "patient_sessions_expires_idx" ON "patient_sessions" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_publicado_por_users_id_fk" FOREIGN KEY ("publicado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_anulada_por_users_id_fk" FOREIGN KEY ("anulada_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patients_tenant_documento_idx" ON "patients" USING btree ("tenant_id","documento");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "during" tsrange GENERATED ALWAYS AS (tsrange("fecha" + "hora_ini", "fecha" + "hora_fin", '[)')) STORED;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap" EXCLUDE USING GIST ("doctor_id" WITH =, "during" WITH &&) WHERE ("estado" NOT IN ('cancelada', 'no_show'));--> statement-breakpoint
CREATE INDEX "appointments_during_idx" ON "appointments" USING GIST ("during");