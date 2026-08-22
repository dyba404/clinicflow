import { addDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import { LinkDia } from "./link-dia";
import type { citasEnRango } from "@/lib/console-data";

type Cita = Awaited<ReturnType<typeof citasEnRango>>[number];

const COLUMNAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function VistaSemana({
  lunes,
  hoyISO,
  citas,
  colorPorDoctor,
}: {
  lunes: Date;
  hoyISO: string;
  citas: Cita[];
  colorPorDoctor: Map<string, string>;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => ({
    fecha: addDays(lunes, i),
    fechaISO: format(addDays(lunes, i), "yyyy-MM-dd"),
    citas: citas
      .filter((c) => c.fecha === format(addDays(lunes, i), "yyyy-MM-dd"))
      .sort((a, b) => a.horaIni.localeCompare(b.horaIni)),
  }));
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="grid min-w-[760px] grid-cols-7">
        {dias.map((d, i) => {
          const esHoy = d.fechaISO === hoyISO;
          return (
            <div key={d.fechaISO} className={cn(i > 0 && "border-l")}>
              <LinkDia
                fechaISO={d.fechaISO}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 px-2 py-2 transition-colors hover:bg-muted/50",
                  esHoy && "bg-accent",
                )}
              >
                <span className="text-[11px] uppercase text-muted-foreground">{COLUMNAS[i]}</span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    esHoy && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(d.fecha, "d")}
                </span>
              </LinkDia>
              <div className="min-h-32 space-y-1 p-1.5">
                {d.citas.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground/60">—</p>
                ) : (
                  d.citas.map((c) => {
                    const atenuada = c.estado === "cancelada" || c.estado === "no_show";
                    const color = c.doctorId ? colorPorDoctor.get(c.doctorId) : undefined;
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "flex items-center gap-1 overflow-hidden rounded border-l-2 bg-muted/30 px-1.5 py-1",
                          !color && "border-l-muted-foreground/40",
                          atenuada && "opacity-45",
                        )}
                        style={color ? { borderLeftColor: color } : undefined}
                      >
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {c.horaIni.slice(0, 5)}
                        </span>
                        <span className="truncate text-xs font-medium">{c.patientNombre}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
