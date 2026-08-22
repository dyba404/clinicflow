import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  date,
  time,
  timestamp,
  index,
  unique,
  uniqueIndex,
  jsonb,
  bigserial,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["owner", "receptionist", "assistant", "doctor"]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "solicitada",
  "confirmada",
  "en_espera",
  "en_atencion",
  "atendida",
  "no_show",
  "cancelada",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "yape",
  "plin",
  "efectivo",
  "tarjeta_pos",
  "tarjeta_online",
  "otro",
]);

export const planCodeEnum = pgEnum("plan_code", ["free", "pro", "premium"]);

export const planStatusEnum = pgEnum("plan_status", [
  "activo",
  "por_renovar",
  "suspendido",
  "cancelado",
]);

export const triageLevelEnum = pgEnum("triage_level", [
  "leve",
  "moderado",
  "urgente",
]);

export const orderTypeEnum = pgEnum("order_type", ["laboratorio", "imagen"]);

export const orderStatusEnum = pgEnum("order_status", [
  "ordenada",
  "toma",
  "procesada",
  "validada",
  "liberada",
  "entregada",
  "cancelada",
]);

export const admissionTypeEnum = pgEnum("admission_type", [
  "emergencia",
  "observacion",
  "internamiento",
]);

export const admissionStatusEnum = pgEnum("admission_status", [
  "activa",
  "egresada",
  "abandono",
]);

export const dischargeTypeEnum = pgEnum("discharge_type", ["medica", "voluntaria"]);

export const bedTypeEnum = pgEnum("bed_type", ["cama", "sillon", "aislamiento"]);

export const bedStateEnum = pgEnum("bed_state", ["libre", "ocupada", "limpieza", "bloqueada"]);

export const vitalSignsTurnEnum = pgEnum("vital_signs_turn", ["manana", "tarde", "noche"]);

export const surgeryStatusEnum = pgEnum("surgery_status", [
  "programada",
  "intra",
  "urpa",
  "completada",
  "cancelada",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "borrador",
  "emitida",
  "pagada",
  "anulada",
]);

export const receiptTypeEnum = pgEnum("receipt_type", [
  "boleta",
  "factura",
  "nota_credito",
  "nota_debito",
]);

export const reminderTypeEnum = pgEnum("reminder_type", [
  "recordatorio_24h",
  "confirmacion_solicitud",
  "recall",
  "reprogramacion",
  "waitlist",
]);

export const reminderStatusEnum = pgEnum("reminder_status", [
  "programado",
  "enviado",
  "error",
]);

export const attachmentTypeEnum = pgEnum("attachment_type", [
  "rx",
  "consentimiento",
  "otro",
]);

export const vatRegimenEnum = pgEnum("vat_regimen", ["RUS", "RER", "MYPE"]);

export const vatEmisionEnum = pgEnum("vat_emision", ["manual", "electronica"]);

export const receiptSunatEstadoEnum = pgEnum("receipt_sunat_estado", [
  "manual",
  "pendiente_envio",
  "aceptado",
  "rechazado",
  "baja",
  "baja_pendiente",
  "baja_aceptada",
  "baja_rechazada",
]);

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "ingreso",
  "consumo",
  "ajuste",
  "merma",
]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "borrador",
  "enviado",
  "aprobado",
  "rechazado",
  "convertido",
]);

export const installmentStatusEnum = pgEnum("installment_status", [
  "pendiente",
  "parcial",
  "pagada",
  "vencida",
  "cancelada",
]);

export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "activa",
  "ofrecida",
  "aceptada",
  "expirada",
  "retirada",
]);

export const campaignTypeEnum = pgEnum("campaign_type", ["cumple", "reactivacion"]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "programada",
  "completada",
  "error",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedReason: text("locked_reason"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("America/Lima"),
  bookingMode: text("booking_mode").notNull().default("solicitud"),
  restringirFueraHorario: boolean("restringir_fuera_horario").notNull().default(false),
  googlePlaceId: text("google_place_id"),
  googleReviewUrl: text("google_review_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("receptionist"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("memberships_team_user_key").on(t.teamId, t.userId),
    index("memberships_user_id_idx").on(t.userId),
    index("memberships_team_id_idx").on(t.teamId),
  ],
);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("receptionist"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id"),
    nombre: text("nombre").notNull(),
    especialidad: text("especialidad"),
    duracionMin: integer("duracion_min").notNull(),
    precio: numeric("precio", { precision: 10, scale: 2 }).notNull(),
    bufferMin: integer("buffer_min").notNull().default(0),
    codigoProcedimiento: text("codigo_procedimiento"),
    activo: boolean("activo").notNull().default(true),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("services_tenant_idx").on(t.tenantId)],
);

export const staffSchedules = pgTable(
  "staff_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    horaIni: time("hora_ini").notNull(),
    horaFin: time("hora_fin").notNull(),
  },
  (t) => [index("staff_schedules_membership_idx").on(t.membershipId)],
);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    celular: text("celular").notNull(),
    email: text("email"),
    documento: text("documento"),
    fnac: date("fnac"),
    alergias: text("alergias"),
    antecedentes: text("antecedentes"),
    medicacion: text("medicacion"),
    gestacion: boolean("gestacion").notNull().default(false),
    activo: boolean("activo").notNull().default(true),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("patients_tenant_celular_key").on(t.tenantId, t.celular),
    index("patients_tenant_idx").on(t.tenantId),
  ],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id"),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    doctorId: uuid("doctor_id"),
    preferredDoctorId: uuid("preferred_doctor_id"),
    fecha: date("fecha").notNull(),
    horaIni: time("hora_ini").notNull(),
    horaFin: time("hora_fin").notNull(),
    estado: appointmentStatusEnum("estado").notNull().default("solicitada"),
    triageNivel: triageLevelEnum("triage_nivel"),
    triajeAt: timestamp("triaje_at", { withTimezone: true }),
    triajePor: uuid("triaje_por"),
    modoSolicitud: boolean("modo_solicitud").notNull().default(true),
    monto: numeric("monto", { precision: 10, scale: 2 }).notNull().default("0"),
    montoPagado: numeric("monto_pagado", { precision: 10, scale: 2 }).notNull().default("0"),
    notas: text("notas"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("appointments_tenant_fecha_idx").on(t.tenantId, t.fecha),
    index("appointments_estado_idx").on(t.estado),
    index("appointments_doctor_fecha_idx").on(t.doctorId, t.fecha),
  ],
);

export const blockedSlots = pgTable(
  "blocked_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id"),
    fecha: date("fecha").notNull(),
    horaIni: time("hora_ini").notNull(),
    horaFin: time("hora_fin").notNull(),
    motivo: text("motivo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("blocked_slots_tenant_fecha_idx").on(t.tenantId, t.fecha)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id"),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    patientId: uuid("patient_id").references(() => patients.id),
    monto: numeric("monto", { precision: 10, scale: 2 }).notNull(),
    metodo: paymentMethodEnum("metodo").notNull(),
    referencia: text("referencia"),
    registradoPor: uuid("registrado_por"),
    cajaCerrada: boolean("caja_cerrada").notNull().default(false),
    estado: text("estado").notNull().default("valido"),
    anuladoPor: uuid("anulado_por"),
    anuladoAt: timestamp("anulado_at", { withTimezone: true }),
    motivoAnulacion: text("motivo_anulacion"),
    anuladoConId: uuid("anulado_con_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

export const subscriptions = pgTable("subscriptions", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  plan: planCodeEnum("plan").notNull().default("free"),
  estado: planStatusEnum("estado").notNull().default("activo"),
  vence: date("vence"),
  monto: numeric("monto", { precision: 10, scale: 2 }),
  metodoPago: text("metodo_pago"),
  nota: text("nota"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cashClosures = pgTable(
  "cash_closures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    fecha: date("fecha").notNull(),
    apertura: numeric("apertura", { precision: 10, scale: 2 }).notNull().default("0"),
    cierreReal: numeric("cierre_real", { precision: 10, scale: 2 }).notNull(),
    cierreSistema: numeric("cierre_sistema", { precision: 10, scale: 2 }).notNull(),
    diferencia: numeric("diferencia", { precision: 10, scale: 2 }).notNull(),
    cerradoPor: uuid("cerrado_por").references(() => users.id),
    estado: text("estado").notNull().default("cerrado"),
    reabiertoPor: uuid("reabierto_por"),
    reabiertoAt: timestamp("reabierto_at", { withTimezone: true }),
    motivoReapertura: text("motivo_reapertura"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cash_closures_tenant_fecha_idx").on(t.tenantId, t.fecha),
    index("cash_closures_tenant_idx").on(t.tenantId),
  ],
);

export const clinicalRecords = pgTable(
  "clinical_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    nota: text("nota").notNull(),
    adjuntos: jsonb("adjuntos"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clinical_records_patient_idx").on(t.patientId)],
);

export const cie10 = pgTable(
  "cie10",
  {
    codigo: text("codigo").primaryKey(),
    descripcion: text("descripcion").notNull(),
    orden: text("orden"),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [index("cie10_descripcion_idx").on(t.descripcion)],
);

export const consultations = pgTable(
  "consultations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    motivoConsulta: text("motivo_consulta"),
    subjetivo: text("subjetivo"),
    objetivo: text("objetivo"),
    evaluacion: text("evaluacion"),
    plan: text("plan"),
    constantes: jsonb("constantes"),
    doctorMembershipId: uuid("doctor_membership_id"),
    creadoPor: uuid("creado_por").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("consultations_tenant_idx").on(t.tenantId, t.createdAt),
    index("consultations_patient_idx").on(t.patientId),
    index("consultations_appointment_idx").on(t.appointmentId),
  ],
);

export const consultDiagnoses = pgTable(
  "consult_diagnoses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    cie10Codigo: text("cie10_codigo")
      .notNull()
      .references(() => cie10.codigo),
    esPrincipal: boolean("es_principal").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("consult_diagnoses_consultation_idx").on(t.consultationId),
    unique("consult_diagnoses_consult_cie10_key").on(t.consultationId, t.cie10Codigo),
  ],
);

export const prescriptions = pgTable(
  "prescriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    medicamento: text("medicamento").notNull(),
    dosis: text("dosis"),
    frecuencia: text("frecuencia"),
    duracionDias: integer("duracion_dias"),
    indicaciones: text("indicaciones"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("prescriptions_consultation_idx").on(t.consultationId)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    consultationId: uuid("consultation_id").references(() => consultations.id),
    tipo: orderTypeEnum("tipo").notNull().default("laboratorio"),
    nombre: text("nombre").notNull(),
    indicacion: text("indicacion"),
    estado: orderStatusEnum("estado").notNull().default("ordenada"),
    prioridad: integer("prioridad").notNull().default(0),
    solicitadoPor: uuid("solicitado_por").references(() => users.id),
    resultado: jsonb("resultado"),
    resultadoAt: timestamp("resultado_at", { withTimezone: true }),
    validadoPor: uuid("validado_por").references(() => users.id),
    motivoRevision: text("motivo_revision"),
    rev: integer("rev").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_tenant_estado_idx").on(t.tenantId, t.estado),
    index("orders_patient_idx").on(t.patientId),
    index("orders_appointment_idx").on(t.appointmentId),
  ],
);

export const orderResults = pgTable(
  "order_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    parametro: text("parametro").notNull(),
    valorText: text("valor_text"),
    valorNum: numeric("valor_num", { precision: 18, scale: 6 }),
    unidad: text("unidad"),
    referencia: text("referencia"),
    flag: text("flag"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_results_order_idx").on(t.orderId)],
);

export const beds = pgTable(
  "beds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    area: text("area"),
    tipo: bedTypeEnum("tipo").notNull().default("cama"),
    estado: bedStateEnum("estado").notNull().default("libre"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("beds_tenant_nombre_idx").on(t.tenantId, t.nombre)],
);

export const admissions = pgTable(
  "admissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    consultationId: uuid("consultation_id").references(() => consultations.id),
    tipo: admissionTypeEnum("tipo").notNull().default("internamiento"),
    motivo: text("motivo").notNull(),
    estado: admissionStatusEnum("estado").notNull().default("activa"),
    admittedById: uuid("admitted_by_id").references(() => users.id),
    admittedAt: timestamp("admitted_at", { withTimezone: true }).notNull().defaultNow(),
    dischargedAt: timestamp("discharged_at", { withTimezone: true }),
    altaTipo: dischargeTypeEnum("alta_tipo"),
    epicrisis: text("epicrisis"),
  },
  (t) => [
    index("admissions_tenant_estado_idx").on(t.tenantId, t.estado),
    index("admissions_patient_idx").on(t.patientId),
  ],
);

export const bedAssignments = pgTable(
  "bed_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    admissionId: uuid("admission_id")
      .notNull()
      .references(() => admissions.id, { onDelete: "cascade" }),
    bedId: uuid("bed_id")
      .notNull()
      .references(() => beds.id),
    motivo: text("motivo"),
    desde: timestamp("desde", { withTimezone: true }).notNull().defaultNow(),
    hasta: timestamp("hasta", { withTimezone: true }),
  },
  (t) => [
    index("bed_assignments_admission_idx").on(t.admissionId),
    index("bed_assignments_bed_idx").on(t.bedId),
  ],
);

export const evolutions = pgTable(
  "evolutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    admissionId: uuid("admission_id")
      .notNull()
      .references(() => admissions.id, { onDelete: "cascade" }),
    fecha: date("fecha").notNull(),
    nota: text("nota").notNull(),
    doctorMembershipId: uuid("doctor_membership_id").references(() => memberships.id),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evolutions_admission_idx").on(t.admissionId)],
);

export const vitalSigns = pgTable(
  "vital_signs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    admissionId: uuid("admission_id")
      .notNull()
      .references(() => admissions.id, { onDelete: "cascade" }),
    turno: vitalSignsTurnEnum("turno").notNull(),
    paSistolica: integer("pa_sistolica"),
    paDiastolica: integer("pa_diastolica"),
    temperatura: numeric("temperatura", { precision: 4, scale: 1 }),
    fc: integer("fc"),
    fr: integer("fr"),
    spo2: integer("spo2"),
    nota: text("nota"),
    registradoPor: uuid("registrado_por").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("vital_signs_admission_idx").on(t.admissionId),
    index("vital_signs_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);

export const dispensations = pgTable(
  "dispensations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").references(() => patients.id),
    orderId: uuid("order_id").references(() => orders.id),
    prescriptionId: uuid("prescription_id").references(() => prescriptions.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    lotId: uuid("lot_id").references(() => inventoryLots.id),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
    dispensadoPor: uuid("dispensado_por").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("dispensations_tenant_idx").on(t.tenantId, t.createdAt),
    index("dispensations_order_idx").on(t.orderId),
  ],
);

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    tipo: receiptTypeEnum("tipo").notNull().default("boleta"),
    serie: text("serie").notNull(),
    correlativo: integer("correlativo").notNull(),
    estado: text("estado").notNull().default("manual"),
    sunatEstado: receiptSunatEstadoEnum("sunat_estado").notNull().default("manual"),
    sunatHash: text("sunat_hash"),
    cdrUrl: text("cdr_url"),
    xmlUrl: text("xml_url"),
    pdfUrl: text("pdf_url"),
    emitidaAt: timestamp("emitida_at", { withTimezone: true }),
    afectadoId: uuid("afectado_id"),
    bajaTicket: text("baja_ticket"),
    bajaEnviadaAt: timestamp("baja_enviada_at", { withTimezone: true }),
    bajaMotivo: text("baja_motivo"),
    emitidaPor: uuid("emitida_por").references(() => users.id),
    registradoPor: uuid("registrado_por").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("receipts_payment_unique")
      .on(t.paymentId)
      .where(sql`${t.tipo} in ('boleta', 'factura')`),
    unique("receipts_correlativo_key").on(t.tenantId, t.tipo, t.serie, t.correlativo),
    index("receipts_tenant_idx").on(t.tenantId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    accion: text("accion").notNull(),
    entidad: text("entidad"),
    entidadId: uuid("entidad_id"),
    ip: text("ip"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionToken: text("session_token").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").references(() => teams.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id").references(() => memberships.id, { onDelete: "cascade" }),
    impersonatedByUserId: uuid("impersonated_by_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
    index("sessions_impersonated_by_idx").on(t.impersonatedByUserId),
  ],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_resets_user_id_idx").on(t.userId)],
);

export const impersonationRequests = pgTable(
  "impersonation_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("impersonation_requests_expires_idx").on(t.expiresAt)],
);

export const notificationSettings = pgTable("notification_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  recordatorio24h: boolean("recordatorio_24h").notNull().default(true),
  recordatorio24hCanales: text("recordatorio_24h_canales").notNull().default("email"),
  confirmacionSolicitud: boolean("confirmacion_solicitud").notNull().default(true),
  confirmacionCanales: text("confirmacion_canales").notNull().default("email"),
  plantillaRecordatorio: text("plantilla_recordatorio").notNull().default("recordatorio_cita"),
  idiomaPlantilla: text("idioma_plantilla").notNull().default("es"),
  resenaAutomatica: boolean("resena_automatica").notNull().default(false),
  recallAuto: boolean("recall_auto").notNull().default(false),
  digestDiario: boolean("digest_diario").notNull().default(true),
  emailFrom: text("email_from"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    tipo: reminderTypeEnum("tipo").notNull(),
    estado: reminderStatusEnum("estado").notNull().default("programado"),
    pacienteId: uuid("paciente_id").references(() => patients.id),
    citaId: uuid("cita_id").references(() => appointments.id),
    canal: text("canal").notNull().default("email"),
    destinatario: text("destinatario"),
    mensaje: text("mensaje"),
    error: text("error"),
    enviadoPor: uuid("enviado_por").references(() => users.id),
    enviadoAt: timestamp("enviado_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reminders_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("reminders_estado_idx").on(t.estado),
  ],
);

export const patientMagicTokens = pgTable(
  "patient_magic_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "cascade",
    }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("patient_magic_tokens_patient_idx").on(t.patientId)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    tipo: attachmentTypeEnum("tipo").notNull().default("otro"),
    fotoTipo: text("foto_tipo"),
    fotoOrden: integer("foto_orden"),
    tratamiento: text("tratamiento"),
    nombre: text("nombre").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storagePath: text("storage_path").notNull(),
    nota: text("nota"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("attachments_patient_idx").on(t.patientId),
    index("attachments_tenant_idx").on(t.tenantId),
  ],
);

export const signedConsents = pgTable(
  "signed_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    citaId: uuid("cita_id").references(() => appointments.id),
    servicioNombre: text("servicio_nombre"),
    attachmentId: uuid("attachment_id").references(() => attachments.id),
    signedBy: text("signed_by").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("signed_consents_patient_idx").on(t.patientId)],
);

// ---------------------------------------------------------------------------
// Sucursales (multi-sucursal)
// ---------------------------------------------------------------------------

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    slug: text("slug").notNull(),
    direccion: text("direccion"),
    telefono: text("telefono"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("branches_tenant_slug_key").on(t.tenantId, t.slug),
    index("branches_tenant_idx").on(t.tenantId),
  ],
);

// ---------------------------------------------------------------------------
// Fiscal (facturación electrónica vía sidecar Greenter/licet)
// ---------------------------------------------------------------------------

export const vatSettings = pgTable("vat_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  ruc: text("ruc"),
  razonSocial: text("razon_social"),
  regimen: vatRegimenEnum("regimen").notNull().default("RUS"),
  ambiente: text("ambiente").notNull().default("beta"),
  claveSolEnc: text("clave_sol_enc"),
  usuarioSol: text("usuario_sol"),
  certificadoEnc: text("certificado_enc"),
  serieBoleta: text("serie_boleta").notNull().default("B001"),
  serieFactura: text("serie_factura").notNull().default("F001"),
  corrBoleta: integer("corr_boleta").notNull().default(0),
  corrFactura: integer("corr_factura").notNull().default(0),
  emision: vatEmisionEnum("emision").notNull().default("manual"),
  emisionAuto: boolean("emision_auto").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Inventario (items, lotes, kardex, recetas)
// ---------------------------------------------------------------------------

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    categoria: text("categoria").notNull().default("general"),
    unidad: text("unidad").notNull().default("und"),
    stock: numeric("stock", { precision: 12, scale: 2 }).notNull().default("0"),
    stockMin: numeric("stock_min", { precision: 12, scale: 2 }).notNull().default("1"),
    costoUnit: numeric("costo_unit", { precision: 10, scale: 2 }).notNull().default("0"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inventory_items_tenant_idx").on(t.tenantId)],
);

export const inventoryLots = pgTable(
  "inventory_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    lote: text("lote").notNull(),
    vence: date("vence"),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inventory_lots_item_idx").on(t.itemId)],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    tipo: stockMovementTypeEnum("tipo").notNull(),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    nota: text("nota"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_movements_item_idx").on(t.itemId),
    index("stock_movements_tenant_idx").on(t.tenantId),
  ],
);

export const serviceMaterials = pgTable(
  "service_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [unique("service_materials_unique").on(t.serviceId, t.itemId)],
);

// ---------------------------------------------------------------------------
// Presupuestos y cuotas
// ---------------------------------------------------------------------------

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id").references(() => memberships.id),
    titulo: text("titulo").notNull(),
    items: jsonb("items").notNull(),
    total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
    estado: quoteStatusEnum("estado").notNull().default("borrador"),
    expiraEn: date("expira_en"),
    nota: text("nota"),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    seguimiento1At: timestamp("seguimiento1_at", { withTimezone: true }),
    seguimiento2At: timestamp("seguimiento2_at", { withTimezone: true }),
  },
  (t) => [
    index("quotes_patient_idx").on(t.patientId),
    index("quotes_tenant_idx").on(t.tenantId),
  ],
);

export const installments = pgTable(
  "installments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").references(() => quotes.id),
    concepto: text("concepto").notNull(),
    n: integer("n").notNull().default(1),
    monto: numeric("monto", { precision: 10, scale: 2 }).notNull(),
    pagado: numeric("pagado", { precision: 10, scale: 2 }).notNull().default("0"),
    vence: date("vence"),
    estado: installmentStatusEnum("estado").notNull().default("pendiente"),
    paymentId: uuid("payment_id").references(() => payments.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("installments_patient_idx").on(t.patientId),
    index("installments_tenant_idx").on(t.tenantId),
  ],
);

// ---------------------------------------------------------------------------
// Comisiones por doctor
// ---------------------------------------------------------------------------

export const commissionSettings = pgTable("commission_settings", {
  membershipId: uuid("membership_id")
    .primaryKey()
    .references(() => memberships.id, { onDelete: "cascade" }),
  porcentaje: numeric("porcentaje", { precision: 5, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commissionEntries = pgTable(
  "commission_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    doctorMembershipId: uuid("doctor_membership_id")
      .notNull()
      .references(() => memberships.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    base: numeric("base", { precision: 10, scale: 2 }).notNull(),
    porcentaje: numeric("porcentaje", { precision: 5, scale: 2 }).notNull(),
    monto: numeric("monto", { precision: 10, scale: 2 }).notNull(),
    periodo: text("periodo").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("commission_entries_payment_doctor_key").on(t.paymentId, t.doctorMembershipId),
    index("commission_entries_tenant_periodo_idx").on(t.tenantId, t.periodo),
  ],
);

// ---------------------------------------------------------------------------
// EPS / seguros
// ---------------------------------------------------------------------------

export const insurers = pgTable(
  "insurers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    ruc: text("ruc"),
    telefono: text("telefono"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("insurers_tenant_idx").on(t.tenantId)],
);

export const patientCoverages = pgTable(
  "patient_coverages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    insurerId: uuid("insurer_id")
      .notNull()
      .references(() => insurers.id, { onDelete: "cascade" }),
    plan: text("plan"),
    copagoPct: numeric("copago_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    vigenteDesde: date("vigente_desde"),
    vigenteHasta: date("vigente_hasta"),
    activo: boolean("activo").notNull().default(true),
    notas: text("notas"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("patient_coverages_patient_idx").on(t.patientId)],
);

// ---------------------------------------------------------------------------
// Lista de espera anti-huecos
// ---------------------------------------------------------------------------

export const waitlists = pgTable(
  "waitlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id),
    preferencia: text("preferencia"),
    prioridad: integer("prioridad").notNull().default(5),
    estado: waitlistStatusEnum("estado").notNull().default("activa"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("waitlists_tenant_estado_idx").on(t.tenantId, t.estado),
  ],
);

// ---------------------------------------------------------------------------
// Reseñas Google
// ---------------------------------------------------------------------------

export const reviewRequests = pgTable(
  "review_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    canal: text("canal").notNull().default("email"),
    enviadoAt: timestamp("enviado_at", { withTimezone: true }),
    respondido: boolean("respondido").notNull().default(false),
    respondidoAt: timestamp("respondido_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("review_requests_tenant_idx").on(t.tenantId)],
);

// ---------------------------------------------------------------------------
// Campañas (cumpleaños / reactivación)
// ---------------------------------------------------------------------------

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    tipo: campaignTypeEnum("tipo").notNull(),
    titulo: text("titulo").notNull(),
    mensaje: text("mensaje").notNull(),
    canal: text("canal").notNull().default("email"),
    estado: campaignStatusEnum("estado").notNull().default("programada"),
    audiencia: jsonb("audiencia").notNull().default("[]"),
    enviadoA: integer("enviado_a").notNull().default(0),
    enviadosOk: integer("enviados_ok").notNull().default(0),
    ejecutadaAt: timestamp("ejecutada_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaigns_tenant_idx").on(t.tenantId)],
);

// ---------------------------------------------------------------------------
// WhatsApp Cloud API (por tenant)
// ---------------------------------------------------------------------------

export const whatsappSettings = pgTable("whatsapp_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  phoneNumberId: text("phone_number_id"),
  tokenEnc: text("token_enc"),
  webhookVerifiedAt: timestamp("webhook_verified_at", { withTimezone: true }),
  activo: boolean("activo").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    waId: text("wa_id"),
    direction: text("direction").notNull(),
    patientId: uuid("patient_id").references(() => patients.id),
    phoneNumber: text("phone_number"),
    body: text("body"),
    estado: text("estado").notNull().default("recibido"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("whatsapp_messages_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("whatsapp_messages_patient_idx").on(t.patientId),
  ],
);

// ---------------------------------------------------------------------------
// ARCO (Ley 29733) — solicitudes de datos
// ---------------------------------------------------------------------------

export const dataRequests = pgTable(
  "data_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    tipo: text("tipo").notNull(),
    estado: text("estado").notNull().default("pendiente"),
    detalle: text("detalle"),
    gestionadoPor: uuid("gestionado_por").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("data_requests_tenant_idx").on(t.tenantId)],
);

// ---------------------------------------------------------------------------
// Sala de operaciones (OLA 3)
// ---------------------------------------------------------------------------

export const surgeryRooms = pgTable(
  "surgery_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("surgery_rooms_tenant_nombre_idx").on(t.tenantId, t.nombre)],
);

export const surgeries = pgTable(
  "surgeries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    admissionId: uuid("admission_id").references(() => admissions.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    roomId: uuid("room_id").references(() => surgeryRooms.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    procedimiento: text("procedimiento").notNull(),
    cirujanoMembershipId: uuid("cirujano_membership_id").references(() => memberships.id),
    anestesiologoMembershipId: uuid("anestesiologo_membership_id").references(() => memberships.id),
    asaClase: text("asa_clase"),
    estado: surgeryStatusEnum("estado").notNull().default("programada"),
    checklistPreop: jsonb("checklist_preop"),
    anestesiaTipo: text("anestesia_tipo"),
    anestesiaNotas: text("anestesia_notas"),
    inicioAt: timestamp("inicio_at", { withTimezone: true }),
    finAt: timestamp("fin_at", { withTimezone: true }),
    equipo: jsonb("equipo"),
    complicaciones: text("complicaciones"),
    urpaNotas: text("urpa_notas"),
    canceladaMotivo: text("cancelada_motivo"),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("surgeries_tenant_estado_idx").on(t.tenantId, t.estado),
    index("surgeries_room_fecha_idx").on(t.roomId, t.scheduledAt),
  ],
);

// ---------------------------------------------------------------------------
// UCI simplificada (OLA 3)
// ---------------------------------------------------------------------------

export const icuStays = pgTable(
  "icu_stays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    admissionId: uuid("admission_id").references(() => admissions.id),
    ingresoAt: timestamp("ingreso_at", { withTimezone: true }).notNull().defaultNow(),
    egresoAt: timestamp("egreso_at", { withTimezone: true }),
    balanceHidrico: jsonb("balance_hidrico"),
    notas: text("notas"),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("icu_stays_tenant_idx").on(t.tenantId, t.ingresoAt)],
);

// ---------------------------------------------------------------------------
// Facturación institucional (OLA 3)
// ---------------------------------------------------------------------------

export const convenios = pgTable(
  "convenios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    insurerId: uuid("insurer_id")
      .notNull()
      .references(() => insurers.id, { onDelete: "cascade" }),
    tipo: text("tipo").notNull(),
    descuentoPct: numeric("descuento_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("convenios_tenant_idx").on(t.tenantId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    convenioId: uuid("convenio_id").references(() => convenios.id),
    admissionId: uuid("admission_id").references(() => admissions.id),
    items: jsonb("items").notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    estado: invoiceStatusEnum("estado").notNull().default("borrador"),
    emitidaAt: timestamp("emitida_at", { withTimezone: true }),
    pagadaAt: timestamp("pagada_at", { withTimezone: true }),
    anuladaMotivo: text("anulada_motivo"),
    createdBy: uuid("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invoices_tenant_estado_idx").on(t.tenantId, t.estado),
    index("invoices_patient_idx").on(t.patientId),
  ],
);

// ---------------------------------------------------------------------------
// Cumplimiento legal por tenant (Ley 29733). Solo el dueño lo edita.
// Los textos null se rellenan con las plantillas de lib/legal.ts usando los
// datos del propio registro (razón social, RUC, etc.) como placeholders.
// ---------------------------------------------------------------------------

export const legalSettings = pgTable("legal_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  razonSocial: text("razon_social"),
  ruc: text("ruc"),
  direccionLegal: text("direccion_legal"),
  emailContactoDatos: text("email_contacto_datos"),
  telefonoContactoDatos: text("telefono_contacto_datos"),
  politicaPrivacidad: text("politica_privacidad"),
  terminosUso: text("terminos_uso"),
  textoConsentimiento: text("texto_consentimiento"),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
