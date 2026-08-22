export type StaffRole = "owner" | "receptionist" | "assistant" | "doctor";

export type AppointmentStatus =
  | "solicitada"
  | "confirmada"
  | "en_espera"
  | "en_atencion"
  | "atendida"
  | "no_show"
  | "cancelada";

export type PaymentMethod =
  | "yape"
  | "plin"
  | "efectivo"
  | "tarjeta_pos"
  | "tarjeta_online"
  | "otro";

export type PlanCode = "free" | "pro" | "premium";

export type PlanStatus = "activo" | "por_renovar" | "suspendido" | "cancelado";

export type BookingMode = "solicitud" | "instantaneo";

export type ToothStatus =
  | "sano"
  | "cariado"
  | "tratado"
  | "extraido"
  | "corona"
  | "ausente";

export type ReminderChannel = "email" | "sms" | "whatsapp";

export type ReceiptType = "boleta" | "factura" | "nota_credito" | "nota_debito";

export interface StaffMember {
  id: string;
  tenantId: string;
  displayName: string;
  email: string;
  role: StaffRole;
  active: boolean;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  durationMin: number;
  price: number;
  active: boolean;
}

export interface Appointment {
  id: string;
  tenantId: string;
  serviceId: string;
  patientId: string;
  doctorId: string | null;
  preferredDoctorId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  amount: number;
  amountPaid: number;
  createdBy: string;
}

export interface Patient {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email: string | null;
  document: string | null;
  birthDate: string | null;
  allergies: string | null;
  pregnant: boolean;
}

export interface Subscription {
  tenantId: string;
  plan: PlanCode;
  status: PlanStatus;
  expiresAt: string | null;
  amount: number | null;
}
