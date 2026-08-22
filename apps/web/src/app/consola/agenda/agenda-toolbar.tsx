"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavegar } from "@/lib/navegar";

type Vista = "dia" | "semana" | "mes";

const VISTAS: Array<{ id: Vista; label: string }> = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
];

const hrefVista = (v: Vista, f: string) => `/consola/agenda?vista=${v}&fecha=${f}`;

export function AgendaToolbar({
  vista,
  fechaISO,
  anteriorISO,
  siguienteISO,
  hoyISO,
  label,
  doctores,
}: {
  vista: Vista;
  fechaISO: string;
  anteriorISO: string;
  siguienteISO: string;
  hoyISO: string;
  label: string;
  doctores: Array<{ id: string; name: string; color: string | null }>;
}) {
  const ir = useNavegar();
  const irVista = (v: Vista, f: string) => ir(hrefVista(v, f));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border bg-muted p-0.5">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => irVista(v.id, fechaISO)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors [@media(pointer:coarse)]:min-h-12 [@media(pointer:coarse)]:px-4 [@media(pointer:coarse)]:text-sm [@media(pointer:coarse)]:inline-flex [@media(pointer:coarse)]:items-center",
                v.id === vista
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => irVista(vista, anteriorISO)}
            aria-label="Anterior"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "size-8 [@media(pointer:coarse)]:min-h-12 [@media(pointer:coarse)]:min-w-12",
            )}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => irVista(vista, hoyISO)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => irVista(vista, siguienteISO)}
            aria-label="Siguiente"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "size-8 [@media(pointer:coarse)]:min-h-12 [@media(pointer:coarse)]:min-w-12",
            )}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <span className="min-w-40 text-center text-sm font-semibold">{label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {doctores.map((d) => (
          <span key={d.id} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: d.color ?? undefined }} />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  );
}