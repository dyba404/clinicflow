import type { AppointmentStatus } from "./types.js";

const TRANSITIONS: Record<AppointmentStatus, ReadonlyArray<AppointmentStatus>> = {
  solicitada: ["confirmada", "cancelada"],
  confirmada: ["en_espera", "cancelada", "no_show", "solicitada"],
  en_espera: ["en_atencion", "cancelada", "no_show", "confirmada"],
  en_atencion: ["atendida", "en_espera"],
  atendida: [],
  no_show: ["confirmada"],
  cancelada: [],
};

export const TERMINALES: ReadonlyArray<AppointmentStatus> = ["atendida", "cancelada"];

export function esTerminal(estado: AppointmentStatus): boolean {
  return TERMINALES.includes(estado);
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: AppointmentStatus, to: AppointmentStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Transición inválida de cita: ${from} -> ${to}`);
  }
}
