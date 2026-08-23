"use client";

import { cn } from "@/lib/utils";
import { useNavegar } from "@/lib/navegar";

const PERIODOS = [
  { id: "dia", label: "Hoy" },
  { id: "semana", label: "7 días" },
  { id: "mes", label: "30 días" },
];

export function ProduccionPeriodos({ periodo }: { periodo: string }) {
  const ir = useNavegar();
  return (
    <div className="flex items-center gap-1 rounded-full border bg-card p-1">
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => ir(`/consola/produccion?periodo=${p.id}`)}
          className={cn(
            "min-h-9 [@media(pointer:coarse)]:min-h-12 [@media(pointer:coarse)]:text-sm",
            p.id === periodo
              ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
              : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
