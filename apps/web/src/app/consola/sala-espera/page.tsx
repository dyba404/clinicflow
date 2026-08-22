import { hasPermission, type AppointmentStatus } from "@clinicflow/core";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { AvanzarEstado } from "@/app/consola/sala-espera/avanzar-estado";
import { AutoRefresh } from "@/app/consola/sala-espera/auto-refresh";
import { TriajeDialog } from "@/app/consola/sala-espera/triaje-dialog";
import {
  TRIAJE_META,
  TRIAJE_SIN_ORDEN,
  type TriageNivel,
} from "@/app/consola/sala-espera/triaje";
import { getDefaultTeam, citasDelDia, doctoresConColor } from "@/lib/console-data";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

interface Columna {
  key: string;
  titulo: string;
  estado: AppointmentStatus;
  siguiente: AppointmentStatus;
  label: string;
  vacio: string;
}

const COLUMNAS: Columna[] = [
  {
    key: "por_llegar",
    titulo: "Por llegar",
    estado: "confirmada",
    siguiente: "en_espera",
    label: "Llegó",
    vacio: "Sin pacientes por llegar",
  },
  {
    key: "en_sala",
    titulo: "En sala",
    estado: "en_espera",
    siguiente: "en_atencion",
    label: "Llamar",
    vacio: "Sala de espera vacía",
  },
  {
    key: "en_atencion",
    titulo: "En atención",
    estado: "en_atencion",
    siguiente: "atendida",
    label: "Finalizar",
    vacio: "Nadie en atención",
  },
];

export default async function SalaEsperaPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  const puedeTriaje = hasPermission(session.role, "checkin.perform");

  const [citas, doctores] = await Promise.all([
    citasDelDia(team.id, hoyLima()),
    doctoresConColor(team.id),
  ]);

  const enFila = citas.filter((c) =>
    ["confirmada", "en_espera", "en_atencion"].includes(c.estado),
  );
  const atendidas = citas.filter((c) => c.estado === "atendida").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Sala de espera"
        description={`Kanban en tiempo real. ${enFila.length} en fila · ${atendidas} atendidas hoy. Nunca visible para pacientes.`}
      />

      <AutoRefresh>
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNAS.map((col) => {
            let items = enFila.filter((c) => c.estado === col.estado);
            if (col.key === "en_sala") {
              items = [...items].sort((a, b) => {
                const oa = a.triageNivel ? TRIAJE_META[a.triageNivel].orden : TRIAJE_SIN_ORDEN;
                const ob = b.triageNivel ? TRIAJE_META[b.triageNivel].orden : TRIAJE_SIN_ORDEN;
                if (oa !== ob) return oa - ob;
                return a.triajeAt && b.triajeAt
                  ? a.triajeAt.getTime() - b.triajeAt.getTime()
                  : a.horaIni.localeCompare(b.horaIni);
              });
            }
            return (
              <section
                key={col.key}
                className="flex flex-col rounded-2xl border bg-muted/30"
              >
                <header className="flex items-center justify-between gap-2 p-4 pb-3">
                  <h3 className="text-sm font-semibold">{col.titulo}</h3>
                  <Badge variant="gray" className="tabular-nums">
                    {items.length}
                  </Badge>
                </header>
                <div className="flex flex-1 flex-col gap-3 px-3 pb-3">
                  {items.length === 0 ? (
                    <div className="flex min-h-[96px] flex-1 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm text-muted-foreground">
                      {col.vacio}
                    </div>
                  ) : (
                    items.map((c) => {
                      const doc = doctores.find((d) => d.id === c.doctorId);
                      const meta = c.triageNivel
                        ? TRIAJE_META[c.triageNivel]
                        : null;
                      return (
                        <Card key={c.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold tabular-nums">
                                {c.horaIni.slice(0, 5)}
                              </span>
                              {meta ? (
                                <Badge variant={meta.variant}>{meta.label}</Badge>
                              ) : doc ? (
                                <span
                                  className="size-2.5 rounded-full"
                                  style={{ background: doc.color }}
                                  title={doc.name}
                                />
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-sm font-semibold">
                              {c.patientNombre}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {c.servicio}
                            </p>
                            <div className="mt-3 flex gap-2">
                              {col.key === "en_sala" && puedeTriaje ? (
                                <TriajeDialog
                                  citaId={c.id}
                                  paciente={c.patientNombre}
                                  nivelActual={(c.triageNivel as TriageNivel | null) ?? null}
                                />
                              ) : null}
                              <AvanzarEstado
                                citaId={c.id}
                                paciente={c.patientNombre}
                                de={c.estado as AppointmentStatus}
                                a={col.siguiente}
                                label={col.label}
                                className="flex-1"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </AutoRefresh>
    </div>
  );
}
