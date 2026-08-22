export type TriageNivel = "leve" | "moderado" | "urgente";

export const TRIAJES: readonly TriageNivel[] = ["leve", "moderado", "urgente"];

export const TRIAJE_META: Record<
  TriageNivel,
  {
    label: string;
    descripcion: string;
    variant: "destructive" | "amber" | "teal";
    punto: string;
    orden: number;
  }
> = {
  urgente: {
    label: "Urgente",
    descripcion: "Atender de inmediato",
    variant: "destructive",
    punto: "bg-red-500",
    orden: 0,
  },
  moderado: {
    label: "Moderado",
    descripcion: "Prioridad media",
    variant: "amber",
    punto: "bg-amber-500",
    orden: 1,
  },
  leve: {
    label: "Leve",
    descripcion: "Orden de llegada",
    variant: "teal",
    punto: "bg-teal-500",
    orden: 2,
  },
};

export const TRIAJE_SIN_ORDEN = 3;
