CREATE TABLE "appointment_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"estado_from" "appointment_status",
	"estado_to" "appointment_status" NOT NULL,
	"changed_by" uuid,
	"motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "no_show_recovery" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_status_events" ADD CONSTRAINT "appointment_status_events_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_events" ADD CONSTRAINT "appointment_status_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_events" ADD CONSTRAINT "appointment_status_events_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_status_events_cita_idx" ON "appointment_status_events" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_status_events_tenant_idx" ON "appointment_status_events" USING btree ("tenant_id");