CREATE TYPE "public"."appointment_status" AS ENUM('solicitada', 'confirmada', 'en_espera', 'en_atencion', 'atendida', 'no_show', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."attachment_type" AS ENUM('rx', 'consentimiento', 'otro');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('programada', 'completada', 'error');--> statement-breakpoint
CREATE TYPE "public"."campaign_type" AS ENUM('cumple', 'reactivacion');--> statement-breakpoint
CREATE TYPE "public"."installment_status" AS ENUM('pendiente', 'parcial', 'pagada', 'vencida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."lab_order_status" AS ENUM('enviado', 'fabricacion', 'recibido', 'colocado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('ordenada', 'toma', 'procesada', 'validada', 'liberada', 'entregada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('laboratorio', 'imagen');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('yape', 'plin', 'efectivo', 'tarjeta_pos', 'tarjeta_online', 'otro');--> statement-breakpoint
CREATE TYPE "public"."plan_code" AS ENUM('free', 'pro', 'premium');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('activo', 'por_renovar', 'suspendido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('borrador', 'enviado', 'aprobado', 'rechazado', 'convertido');--> statement-breakpoint
CREATE TYPE "public"."receipt_sunat_estado" AS ENUM('manual', 'pendiente_envio', 'aceptado', 'rechazado', 'baja', 'baja_pendiente', 'baja_aceptada', 'baja_rechazada');--> statement-breakpoint
CREATE TYPE "public"."receipt_type" AS ENUM('boleta', 'factura', 'nota_credito', 'nota_debito');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('programado', 'enviado', 'error');--> statement-breakpoint
CREATE TYPE "public"."reminder_type" AS ENUM('recordatorio_24h', 'confirmacion_solicitud', 'recall', 'reprogramacion', 'waitlist');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'receptionist', 'assistant', 'doctor');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('ingreso', 'consumo', 'ajuste', 'merma');--> statement-breakpoint
CREATE TYPE "public"."triage_level" AS ENUM('leve', 'moderado', 'urgente');--> statement-breakpoint
CREATE TYPE "public"."vat_emision" AS ENUM('manual', 'electronica');--> statement-breakpoint
CREATE TYPE "public"."vat_regimen" AS ENUM('RUS', 'RER', 'MYPE');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('activa', 'ofrecida', 'aceptada', 'expirada', 'retirada');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"service_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid,
	"preferred_doctor_id" uuid,
	"fecha" date NOT NULL,
	"hora_ini" time NOT NULL,
	"hora_fin" time NOT NULL,
	"estado" "appointment_status" DEFAULT 'solicitada' NOT NULL,
	"triage_nivel" "triage_level",
	"triaje_at" timestamp with time zone,
	"triaje_por" uuid,
	"modo_solicitud" boolean DEFAULT true NOT NULL,
	"monto" numeric(10, 2) DEFAULT '0' NOT NULL,
	"monto_pagado" numeric(10, 2) DEFAULT '0' NOT NULL,
	"notas" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"tipo" "attachment_type" DEFAULT 'otro' NOT NULL,
	"foto_tipo" text,
	"foto_orden" integer,
	"tratamiento" text,
	"nombre" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"nota" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"accion" text NOT NULL,
	"entidad" text,
	"entidad_id" uuid,
	"ip" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"doctor_id" uuid,
	"fecha" date NOT NULL,
	"hora_ini" time NOT NULL,
	"hora_fin" time NOT NULL,
	"motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"direccion" text,
	"telefono" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_tenant_slug_key" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tipo" "campaign_type" NOT NULL,
	"titulo" text NOT NULL,
	"mensaje" text NOT NULL,
	"canal" text DEFAULT 'email' NOT NULL,
	"estado" "campaign_status" DEFAULT 'programada' NOT NULL,
	"audiencia" jsonb DEFAULT '[]' NOT NULL,
	"enviado_a" integer DEFAULT 0 NOT NULL,
	"enviados_ok" integer DEFAULT 0 NOT NULL,
	"ejecutada_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"apertura" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cierre_real" numeric(10, 2) NOT NULL,
	"cierre_sistema" numeric(10, 2) NOT NULL,
	"diferencia" numeric(10, 2) NOT NULL,
	"cerrado_por" uuid,
	"estado" text DEFAULT 'cerrado' NOT NULL,
	"reabierto_por" uuid,
	"reabierto_at" timestamp with time zone,
	"motivo_reapertura" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cie10" (
	"codigo" text PRIMARY KEY NOT NULL,
	"descripcion" text NOT NULL,
	"orden" text,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"nota" text NOT NULL,
	"adjuntos" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"doctor_membership_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"appointment_id" uuid,
	"base" numeric(10, 2) NOT NULL,
	"porcentaje" numeric(5, 2) NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"periodo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_entries_payment_doctor_key" UNIQUE("payment_id","doctor_membership_id")
);
--> statement-breakpoint
CREATE TABLE "commission_settings" (
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"porcentaje" numeric(5, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consult_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"cie10_codigo" text NOT NULL,
	"es_principal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consult_diagnoses_consult_cie10_key" UNIQUE("consultation_id","cie10_codigo")
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"motivo_consulta" text,
	"subjetivo" text,
	"objetivo" text,
	"evaluacion" text,
	"plan" text,
	"constantes" jsonb,
	"doctor_membership_id" uuid,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"detalle" text,
	"gestionado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impersonation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"target_user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "impersonation_requests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"quote_id" uuid,
	"concepto" text NOT NULL,
	"n" integer DEFAULT 1 NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"pagado" numeric(10, 2) DEFAULT '0' NOT NULL,
	"vence" date,
	"estado" "installment_status" DEFAULT 'pendiente' NOT NULL,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"ruc" text,
	"telefono" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text DEFAULT 'general' NOT NULL,
	"unidad" text DEFAULT 'und' NOT NULL,
	"stock" numeric(12, 2) DEFAULT '0' NOT NULL,
	"stock_min" numeric(12, 2) DEFAULT '1' NOT NULL,
	"costo_unit" numeric(10, 2) DEFAULT '0' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"lote" text NOT NULL,
	"vence" date,
	"cantidad" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "role" DEFAULT 'receptionist' NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "lab_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"tipo" text NOT NULL,
	"laboratorio" text,
	"fecha_promesa" date,
	"costo" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estado" "lab_order_status" DEFAULT 'enviado' NOT NULL,
	"notas" text,
	"motivo_revision" text,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"razon_social" text,
	"ruc" text,
	"direccion_legal" text,
	"email_contacto_datos" text,
	"telefono_contacto_datos" text,
	"politica_privacidad" text,
	"terminos_uso" text,
	"texto_consentimiento" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" DEFAULT 'receptionist' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_team_user_key" UNIQUE("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"recordatorio_24h" boolean DEFAULT true NOT NULL,
	"recordatorio_24h_canales" text DEFAULT 'email' NOT NULL,
	"confirmacion_solicitud" boolean DEFAULT true NOT NULL,
	"confirmacion_canales" text DEFAULT 'email' NOT NULL,
	"plantilla_recordatorio" text DEFAULT 'recordatorio_cita' NOT NULL,
	"idioma_plantilla" text DEFAULT 'es' NOT NULL,
	"resena_automatica" boolean DEFAULT false NOT NULL,
	"recall_auto" boolean DEFAULT false NOT NULL,
	"digest_diario" boolean DEFAULT true NOT NULL,
	"email_from" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"consultation_id" uuid,
	"tipo" "order_type" DEFAULT 'laboratorio' NOT NULL,
	"nombre" text NOT NULL,
	"indicacion" text,
	"estado" "order_status" DEFAULT 'ordenada' NOT NULL,
	"prioridad" integer DEFAULT 0 NOT NULL,
	"solicitado_por" uuid,
	"resultado" jsonb,
	"resultado_at" timestamp with time zone,
	"validado_por" uuid,
	"motivo_revision" text,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "patient_coverages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"plan" text,
	"copago_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"vigente_desde" date,
	"vigente_hasta" date,
	"activo" boolean DEFAULT true NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_magic_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_magic_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"celular" text NOT NULL,
	"email" text,
	"documento" text,
	"fnac" date,
	"alergias" text,
	"antecedentes" text,
	"medicacion" text,
	"gestacion" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_tenant_celular_key" UNIQUE("tenant_id","celular")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"appointment_id" uuid,
	"patient_id" uuid,
	"monto" numeric(10, 2) NOT NULL,
	"metodo" "payment_method" NOT NULL,
	"referencia" text,
	"registrado_por" uuid,
	"caja_cerrada" boolean DEFAULT false NOT NULL,
	"estado" text DEFAULT 'valido' NOT NULL,
	"anulado_por" uuid,
	"anulado_at" timestamp with time zone,
	"motivo_anulacion" text,
	"anulado_con_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"medicamento" text NOT NULL,
	"dosis" text,
	"frecuencia" text,
	"duracion_dias" integer,
	"indicaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid,
	"titulo" text NOT NULL,
	"items" jsonb NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estado" "quote_status" DEFAULT 'borrador' NOT NULL,
	"expira_en" date,
	"nota" text,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seguimiento1_at" timestamp with time zone,
	"seguimiento2_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"tipo" "receipt_type" DEFAULT 'boleta' NOT NULL,
	"serie" text NOT NULL,
	"correlativo" integer NOT NULL,
	"estado" text DEFAULT 'manual' NOT NULL,
	"sunat_estado" "receipt_sunat_estado" DEFAULT 'manual' NOT NULL,
	"sunat_hash" text,
	"cdr_url" text,
	"xml_url" text,
	"pdf_url" text,
	"emitida_at" timestamp with time zone,
	"afectado_id" uuid,
	"baja_ticket" text,
	"baja_enviada_at" timestamp with time zone,
	"baja_motivo" text,
	"emitida_por" uuid,
	"registrado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_correlativo_key" UNIQUE("tenant_id","tipo","serie","correlativo")
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tipo" "reminder_type" NOT NULL,
	"estado" "reminder_status" DEFAULT 'programado' NOT NULL,
	"paciente_id" uuid,
	"cita_id" uuid,
	"canal" text DEFAULT 'email' NOT NULL,
	"destinatario" text,
	"mensaje" text,
	"error" text,
	"enviado_por" uuid,
	"enviado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"appointment_id" uuid,
	"patient_id" uuid NOT NULL,
	"canal" text DEFAULT 'email' NOT NULL,
	"enviado_at" timestamp with time zone,
	"respondido" boolean DEFAULT false NOT NULL,
	"respondido_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	CONSTRAINT "service_materials_unique" UNIQUE("service_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"nombre" text NOT NULL,
	"especialidad" text,
	"duracion_min" integer NOT NULL,
	"precio" numeric(10, 2) NOT NULL,
	"buffer_min" integer DEFAULT 0 NOT NULL,
	"codigo_procedimiento" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"membership_id" uuid,
	"impersonated_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "signed_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"cita_id" uuid,
	"servicio_nombre" text,
	"attachment_id" uuid,
	"signed_by" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"hora_ini" time NOT NULL,
	"hora_fin" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"tipo" "stock_movement_type" NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"appointment_id" uuid,
	"nota" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"plan" "plan_code" DEFAULT 'free' NOT NULL,
	"estado" "plan_status" DEFAULT 'activo' NOT NULL,
	"vence" date,
	"monto" numeric(10, 2),
	"metodo_pago" text,
	"nota" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'America/Lima' NOT NULL,
	"booking_mode" text DEFAULT 'solicitud' NOT NULL,
	"restringir_fuera_horario" boolean DEFAULT false NOT NULL,
	"google_place_id" text,
	"google_review_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_reason" text,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vat_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"ruc" text,
	"razon_social" text,
	"regimen" "vat_regimen" DEFAULT 'RUS' NOT NULL,
	"ambiente" text DEFAULT 'beta' NOT NULL,
	"clave_sol_enc" text,
	"usuario_sol" text,
	"certificado_enc" text,
	"serie_boleta" text DEFAULT 'B001' NOT NULL,
	"serie_factura" text DEFAULT 'F001' NOT NULL,
	"corr_boleta" integer DEFAULT 0 NOT NULL,
	"corr_factura" integer DEFAULT 0 NOT NULL,
	"emision" "vat_emision" DEFAULT 'manual' NOT NULL,
	"emision_auto" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"service_id" uuid,
	"preferencia" text,
	"prioridad" integer DEFAULT 5 NOT NULL,
	"estado" "waitlist_status" DEFAULT 'activa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wa_id" text,
	"direction" text NOT NULL,
	"patient_id" uuid,
	"phone_number" text,
	"body" text,
	"estado" text DEFAULT 'recibido' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"phone_number_id" text,
	"token_enc" text,
	"webhook_verified_at" timestamp with time zone,
	"activo" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_slots" ADD CONSTRAINT "blocked_slots_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_cerrado_por_users_id_fk" FOREIGN KEY ("cerrado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_doctor_membership_id_memberships_id_fk" FOREIGN KEY ("doctor_membership_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_settings" ADD CONSTRAINT "commission_settings_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consult_diagnoses" ADD CONSTRAINT "consult_diagnoses_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consult_diagnoses" ADD CONSTRAINT "consult_diagnoses_cie10_codigo_cie10_codigo_fk" FOREIGN KEY ("cie10_codigo") REFERENCES "public"."cie10"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_gestionado_por_users_id_fk" FOREIGN KEY ("gestionado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_requests" ADD CONSTRAINT "impersonation_requests_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_requests" ADD CONSTRAINT "impersonation_requests_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_requests" ADD CONSTRAINT "impersonation_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurers" ADD CONSTRAINT "insurers_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_settings" ADD CONSTRAINT "legal_settings_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_settings" ADD CONSTRAINT "legal_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_solicitado_por_users_id_fk" FOREIGN KEY ("solicitado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_validado_por_users_id_fk" FOREIGN KEY ("validado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_coverages" ADD CONSTRAINT "patient_coverages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_coverages" ADD CONSTRAINT "patient_coverages_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_magic_tokens" ADD CONSTRAINT "patient_magic_tokens_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_magic_tokens" ADD CONSTRAINT "patient_magic_tokens_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_magic_tokens" ADD CONSTRAINT "patient_magic_tokens_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_doctor_id_memberships_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_emitida_por_users_id_fk" FOREIGN KEY ("emitida_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_registrado_por_users_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_paciente_id_patients_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_cita_id_appointments_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_enviado_por_users_id_fk" FOREIGN KEY ("enviado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_materials" ADD CONSTRAINT "service_materials_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_materials" ADD CONSTRAINT "service_materials_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_by_user_id_users_id_fk" FOREIGN KEY ("impersonated_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_consents" ADD CONSTRAINT "signed_consents_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_consents" ADD CONSTRAINT "signed_consents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_consents" ADD CONSTRAINT "signed_consents_cita_id_appointments_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_consents" ADD CONSTRAINT "signed_consents_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_settings" ADD CONSTRAINT "vat_settings_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD CONSTRAINT "whatsapp_settings_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_tenant_fecha_idx" ON "appointments" USING btree ("tenant_id","fecha");--> statement-breakpoint
CREATE INDEX "appointments_estado_idx" ON "appointments" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "appointments_doctor_fecha_idx" ON "appointments" USING btree ("doctor_id","fecha");--> statement-breakpoint
CREATE INDEX "attachments_patient_idx" ON "attachments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "attachments_tenant_idx" ON "attachments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_created_idx" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "blocked_slots_tenant_fecha_idx" ON "blocked_slots" USING btree ("tenant_id","fecha");--> statement-breakpoint
CREATE INDEX "branches_tenant_idx" ON "branches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "campaigns_tenant_idx" ON "campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cash_closures_tenant_fecha_idx" ON "cash_closures" USING btree ("tenant_id","fecha");--> statement-breakpoint
CREATE INDEX "cash_closures_tenant_idx" ON "cash_closures" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cie10_descripcion_idx" ON "cie10" USING btree ("descripcion");--> statement-breakpoint
CREATE INDEX "clinical_records_patient_idx" ON "clinical_records" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "commission_entries_tenant_periodo_idx" ON "commission_entries" USING btree ("tenant_id","periodo");--> statement-breakpoint
CREATE INDEX "consult_diagnoses_consultation_idx" ON "consult_diagnoses" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "consultations_tenant_idx" ON "consultations" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "consultations_patient_idx" ON "consultations" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "consultations_appointment_idx" ON "consultations" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "data_requests_tenant_idx" ON "data_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "impersonation_requests_expires_idx" ON "impersonation_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "installments_patient_idx" ON "installments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "installments_tenant_idx" ON "installments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "insurers_tenant_idx" ON "insurers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_items_tenant_idx" ON "inventory_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_lots_item_idx" ON "inventory_lots" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "lab_orders_patient_idx" ON "lab_orders" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "lab_orders_tenant_idx" ON "lab_orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_team_id_idx" ON "memberships" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_estado_idx" ON "orders" USING btree ("tenant_id","estado");--> statement-breakpoint
CREATE INDEX "orders_patient_idx" ON "orders" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "orders_appointment_idx" ON "orders" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "password_resets_user_id_idx" ON "password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "patient_coverages_patient_idx" ON "patient_coverages" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "patient_magic_tokens_patient_idx" ON "patient_magic_tokens" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "patients_tenant_idx" ON "patients" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_created_idx" ON "payments" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "prescriptions_consultation_idx" ON "prescriptions" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "quotes_patient_idx" ON "quotes" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "quotes_tenant_idx" ON "quotes" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_payment_unique" ON "receipts" USING btree ("payment_id") WHERE "receipts"."tipo" in ('boleta', 'factura');--> statement-breakpoint
CREATE INDEX "receipts_tenant_idx" ON "receipts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "reminders_tenant_created_idx" ON "reminders" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "reminders_estado_idx" ON "reminders" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "review_requests_tenant_idx" ON "review_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "services_tenant_idx" ON "services" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_impersonated_by_idx" ON "sessions" USING btree ("impersonated_by_user_id");--> statement-breakpoint
CREATE INDEX "signed_consents_patient_idx" ON "signed_consents" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "staff_schedules_membership_idx" ON "staff_schedules" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "stock_movements_item_idx" ON "stock_movements" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_idx" ON "stock_movements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "waitlists_tenant_estado_idx" ON "waitlists" USING btree ("tenant_id","estado");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_tenant_created_idx" ON "whatsapp_messages" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_patient_idx" ON "whatsapp_messages" USING btree ("patient_id");