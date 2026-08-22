import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { InvitarForm } from "@/app/consola/personal/invitar-form";
import { MiembroTurnos } from "@/app/consola/personal/miembro-turnos";
import { getDefaultTeam, staffList, turnosPorMiembro } from "@/lib/console-data";
import { getSession } from "@/lib/auth";
import type { StaffRole } from "@clinicflow/core";

export const dynamic = "force-dynamic";

const ROL_LABEL: Record<StaffRole, string> = {
  owner: "Dueño",
  receptionist: "Recepción",
  assistant: "Asistente",
  doctor: "Odontólogo",
};

const ROL_VARIANT: Record<StaffRole, "default" | "teal" | "amber" | "violet" | "gray"> = {
  owner: "default",
  receptionist: "teal",
  assistant: "amber",
  doctor: "violet",
};

const DIA_CURTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface BloqueTurno {
  desde: number;
  hasta: number;
  horaIni: string;
  horaFin: string;
}

function agruparTurnos(
  turnos: Array<{ dayOfWeek: number; horaIni: string; horaFin: string }>,
): BloqueTurno[] {
  const ordenados = [...turnos].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const bloques: BloqueTurno[] = [];
  for (const t of ordenados) {
    const ultimo = bloques[bloques.length - 1];
    if (
      ultimo &&
      ultimo.horaIni === t.horaIni &&
      ultimo.horaFin === t.horaFin &&
      t.dayOfWeek === ultimo.hasta + 1
    ) {
      ultimo.hasta = t.dayOfWeek;
    } else {
      bloques.push({
        desde: t.dayOfWeek,
        hasta: t.dayOfWeek,
        horaIni: t.horaIni,
        horaFin: t.horaFin,
      });
    }
  }
  return bloques;
}

function etiquetaBloque(b: BloqueTurno): string {
  const horas = `${b.horaIni.slice(0, 5)}–${b.horaFin.slice(0, 5)}`;
  if (b.desde === b.hasta) return `${DIA_CURTO[b.desde]} ${horas}`;
  return `${DIA_CURTO[b.desde]}–${DIA_CURTO[b.hasta]} ${horas}`;
}

export default async function PersonalPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "staff.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Personal"
          description="Miembros del equipo, roles y turnos."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el rol Dueño puede ver y gestionar el personal."
          />
        </Card>
      </div>
    );
  }

  const [staff, turnos] = await Promise.all([
    staffList(team.id),
    turnosPorMiembro(team.id),
  ]);
  const activos = staff.filter((s) => s.active);

  const turnosPorId = new Map<string, typeof turnos>();
  for (const t of turnos) {
    const lista = turnosPorId.get(t.membershipId) ?? [];
    lista.push(t);
    turnosPorId.set(t.membershipId, lista);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Personal"
        description={`${activos.length} miembros activos. Solo el dueño puede invitar.`}
      />

      <Card>
        <CardContent className="p-5">
          <InvitarForm />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {staff.map((s) => {
          const delMiembro = turnosPorId.get(s.membershipId) ?? [];
          const bloques = agruparTurnos(delMiembro);
          return (
            <Card
              key={s.membershipId}
              className={s.active ? "transition-colors duration-200 hover:bg-surface-hover" : "opacity-60"}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} className="size-10 text-sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </div>
                  <Badge variant={ROL_VARIANT[s.role as StaffRole] ?? "gray"}>
                    {ROL_LABEL[s.role as StaffRole] ?? s.role}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {s.active ? "Activo" : "Inactivo"}
                </p>

                <div className="mt-4 border-t border-border-subtle pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Turnos
                  </p>
                  {bloques.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Sin horario cargado
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {bloques.map((b) => (
                        <span
                          key={`${b.desde}-${b.horaIni}`}
                          className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground tabular-nums"
                        >
                          {etiquetaBloque(b)}
                        </span>
                      ))}
                    </div>
                  )}
                  <MiembroTurnos
                    membershipId={s.membershipId}
                    name={s.name}
                    turnos={delMiembro.map((t) => ({
                      dayOfWeek: t.dayOfWeek,
                      horaIni: t.horaIni,
                      horaFin: t.horaFin,
                    }))}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
