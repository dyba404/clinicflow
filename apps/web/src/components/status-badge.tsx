import type { AppointmentStatus } from "@clinicflow/core";
import { Badge } from "@/components/ui/badge";

const MAP: Record<AppointmentStatus, { label: string; variant: string; dot: string }> = {
  solicitada: { label: "Solicitada", variant: "amber", dot: "bg-amber-500" },
  confirmada: { label: "Confirmada", variant: "blue", dot: "bg-blue-500" },
  en_espera: { label: "En sala de espera", variant: "violet", dot: "bg-violet-500" },
  en_atencion: { label: "En atención", variant: "violet", dot: "bg-violet-500" },
  atendida: { label: "Atendida", variant: "green", dot: "bg-emerald-500" },
  no_show: { label: "No asistió", variant: "red", dot: "bg-red-500" },
  cancelada: { label: "Cancelada", variant: "gray", dot: "bg-stone-400" },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const m = MAP[status];
  return (
    <Badge variant={m.variant as never}>
      <span className={`size-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </Badge>
  );
}

export function statusLabel(status: AppointmentStatus): string {
  return MAP[status].label;
}
