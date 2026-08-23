CREATE TABLE "admission_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"admission_id" uuid NOT NULL,
	"payment_id" uuid,
	"monto" numeric(10, 2) NOT NULL,
	"metodo" "payment_method" NOT NULL,
	"referencia" text,
	"nota" text,
	"registrado_por" uuid,
	"anulado_at" timestamp with time zone,
	"anulado_por" uuid,
	"motivo_anulacion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admission_handovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"admission_id" uuid NOT NULL,
	"turno" "vital_signs_turn" NOT NULL,
	"entrega_user_id" uuid,
	"recibe_user_id" uuid,
	"resumen" text NOT NULL,
	"pendientes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admission_deposits" ADD CONSTRAINT "admission_deposits_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_deposits" ADD CONSTRAINT "admission_deposits_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_deposits" ADD CONSTRAINT "admission_deposits_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_deposits" ADD CONSTRAINT "admission_deposits_registrado_por_users_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_deposits" ADD CONSTRAINT "admission_deposits_anulado_por_users_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_handovers" ADD CONSTRAINT "admission_handovers_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_handovers" ADD CONSTRAINT "admission_handovers_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_handovers" ADD CONSTRAINT "admission_handovers_entrega_user_id_users_id_fk" FOREIGN KEY ("entrega_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_handovers" ADD CONSTRAINT "admission_handovers_recibe_user_id_users_id_fk" FOREIGN KEY ("recibe_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admission_deposits_admission_idx" ON "admission_deposits" USING btree ("admission_id");--> statement-breakpoint
CREATE INDEX "admission_deposits_tenant_idx" ON "admission_deposits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "admission_handovers_admission_idx" ON "admission_handovers" USING btree ("admission_id");--> statement-breakpoint
CREATE INDEX "admission_handovers_tenant_idx" ON "admission_handovers" USING btree ("tenant_id");