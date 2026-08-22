import { addDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import { LinkDia } from "./link-dia";
import type { citasEnRango } from "@/lib/console-data";

type Cita = Awaited<ReturnType<typeof citasEnRango>>[number];

const COLUMNAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function VistaMes({
  gridIni,
  fecha,
  hoyISO,
  citas,
  colorPorDoctor,
}: {
  gridIni: Date;
  fecha: Date;
  hoyISO: string;
  citas: Cita[];
  colorPorDoctor: Map<string, string>;
}) {
  const porDia = new Map<string, Cita[]>();
  for (const c of citas) {
    const lista = porDia.get(c.fecha) ?? [];
    lista.push(c);
    porDia.set(c.fecha, lista);
  }
  for (const lista of porDia.values()) {
    lista.sort((a, b) => a.horaIni.localeCompare(b.horaIni));
  }
  const celdas = Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridIni, i);
    const fechaISO = format(d, "yyyy-MM-dd");
    return { d, fechaISO, citas: porDia.get(fechaISO) ?? [] };
  });
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b">
          {COLUMNAS.map((c, i) => (
            <div
              key={c}
              className={cn(
                "px-2 py-1.5 text-center text-[11px] font-medium uppercase text-muted-foreground",
                i > 0 && "border-l",
              )}
            >
              {c}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {celdas.map((celda, i) => {
            const otroMes = celda.d.getMonth() !== fecha.getMonth();
            const esHoy = celda.fechaISO === hoyISO;
            const visibles = celda.citas.slice(0, 2);
            const resto = celda.citas.length - visibles.length;
            return (
              <LinkDia
                key={celda.fechaISO}
                fechaISO={celda.fechaISO}
                className={cn(
                  "flex min-h-24 w-full flex-col gap-1 p-1.5 text-left transition-colors hover:bg-muted/40",
                  i % 7 !== 0 && "border-l",
                  i < 35 && "border-b",
                  otroMes && "bg-muted/20 text-muted-foreground",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                      esHoy && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(celda.d, "d")}
                  </span>
                  {celda.citas.length > 0 ? (
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {celda.citas.length} {celda.citas.length === 1 ? "cita" : "citas"}
                    </span>
                  ) : null}
                </div>
                {visibles.map((c) => {
                  const atenuada = c.estado === "cancelada" || c.estado === "no_show";
                  const color = c.doctorId ? colorPorDoctor.get(c.doctorId) : undefined;
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "truncate rounded border-l-2 bg-muted/40 px-1 py-0.5 text-[10px]",
                        !color && "border-l-muted-foreground/40",
                        atenuada && "opacity-45",
                      )}
                      style={color ? { borderLeftColor: color } : undefined}
                    >
                      <span className="tabular-nums text-muted-foreground">{c.horaIni.slice(0, 5)}</span>{" "}
                      <span className="font-medium">{c.patientNombre}</span>
                    </div>
                  );
                })}
                {resto > 0 ? (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    +{resto} más
                  </span>
                ) : null}
              </LinkDia>
            );
          })}
        </div>
      </div>
    </div>
  );
}
