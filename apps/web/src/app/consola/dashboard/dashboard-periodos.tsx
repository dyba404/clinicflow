"use client";

import { cn } from "@/lib/utils";
import { useNavegar } from "@/lib/navegar";

const DIAS_OPCIONES = [7, 14, 30];

export function PeriodosPills({ dias }: { dias: number }) {
  const ir = useNavegar();
  return (
    <div className="flex items-center gap-1 rounded-full border bg-card p-1">
      {DIAS_OPCIONES.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => ir(`/consola/dashboard?dias=${d}`)}
          className={cn(
            "min-h-9 [@media(pointer:coarse)]:min-h-12 [@media(pointer:coarse)]:text-sm",
            d === dias
              ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
              : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {d} días
        </button>
      ))}
    </div>
  );
}