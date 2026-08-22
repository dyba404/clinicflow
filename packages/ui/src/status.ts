import type { AppointmentStatus } from "@clinicflow/core";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  solicitada: "Solicitada",
  confirmada: "Confirmada",
  en_espera: "En espera",
  en_atencion: "En atención",
  atendida: "Atendida",
  no_show: "No asistió",
  cancelada: "Cancelada",
};

export const STATUS_COLOR_VAR: Record<AppointmentStatus, string> = {
  solicitada: "var(--of-st-pendiente)",
  confirmada: "var(--of-st-confirmada)",
  en_espera: "var(--of-st-espera)",
  en_atencion: "var(--of-st-espera)",
  atendida: "var(--of-st-atendida)",
  no_show: "var(--of-st-noshow)",
  cancelada: "var(--of-text-muted)",
};

export interface StatusBadgeProps {
  status: AppointmentStatus;
}

export function statusBadgeStyle(status: AppointmentStatus): Record<string, string> {
  return {
    color: STATUS_COLOR_VAR[status],
    borderColor: STATUS_COLOR_VAR[status],
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: "999px",
    padding: "2px 10px",
    fontSize: "12px",
    fontWeight: "600",
    display: "inline-block",
  };
}
