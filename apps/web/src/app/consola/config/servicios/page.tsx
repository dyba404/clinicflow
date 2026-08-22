import { Stethoscope, Clock, Timer, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { hasPermission } from "@clinicflow/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import {
  EditarServicioButton,
  NuevoServicioButton,
} from "@/app/consola/config/servicios/servicio-dialog";
import { getSession } from "@/lib/auth";
import { getDefaultTeam, serviciosActivosConsola } from "@/lib/console-data";
import { fmtPEN } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ServiciosConfigPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  const rol = session.role;
  const puedeGestionar = hasPermission(rol, "services.manage");

  const servicios = await serviciosActivosConsola(team.id);
  const activos = servicios.filter((s) => s.activo).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Servicios"
        description={`${activos} de ${servicios.length} servicios activos. Duración, buffer y precio definen los horarios disponibles.`}
        action={puedeGestionar ? <NuevoServicioButton /> : undefined}
      />

      {servicios.length === 0 ? (
        <Card>
          <EmptyState
            icon={Stethoscope}
            title="Aún no hay servicios"
            description="Crea tu primer servicio para que los pacientes puedan reservar."
          />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="divide-y divide-border-subtle">
            {servicios.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-4 p-5 transition-colors duration-150 hover:bg-surface-hover"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Stethoscope className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{s.nombre}</p>
                    {s.activo ? (
                      <Badge variant="green">Activo</Badge>
                    ) : (
                      <Badge variant="gray">Inactivo</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="size-3" /> {s.duracionMin} min
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Timer className="size-3" /> +{s.bufferMin} min buffer
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Wallet className="size-3" /> {fmtPEN(Number(s.precio))}
                    </span>
                    {s.citasAtendidas > 0 ? (
                      <span className="tabular-nums">
                        {s.citasAtendidas} citas atendidas
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {fmtPEN(Number(s.precio))}
                </span>
                {puedeGestionar ? (
                  <EditarServicioButton
                    servicio={{
                      id: s.id,
                      nombre: s.nombre,
                      duracionMin: s.duracionMin,
                      precio: s.precio,
                      bufferMin: s.bufferMin,
                      activo: s.activo,
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
