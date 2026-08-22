import { Lock, TimerReset } from "lucide-react";
import { redirect } from "next/navigation";
import { hasPermission } from "@clinicflow/core";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccionesWaitlist } from "@/app/consola/lista-espera/columna-acciones";
import { AgregarDialog } from "@/app/consola/lista-espera/agregar-dialog";
import { getSession } from "@/lib/auth";
import { getDb, waitlists, patients, services } from "@clinicflow/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ListaEsperaPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "waitlist.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Lista de espera"
          description="Cubre huecos de agenda ofreciendo citas a pacientes en espera."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo los roles Dueño/a y Recepción pueden gestionar la lista de espera."
          />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const filas = await db
    .select({
      id: waitlists.id,
      estado: waitlists.estado,
      preferencia: waitlists.preferencia,
      prioridad: waitlists.prioridad,
      patientId: waitlists.patientId,
      pacienteNombre: patients.nombre,
      pacienteCelular: patients.celular,
      pacienteEmail: patients.email,
      servicioNombre: services.nombre,
    })
    .from(waitlists)
    .innerJoin(patients, eq(waitlists.patientId, patients.id))
    .leftJoin(services, eq(waitlists.serviceId, services.id))
    .where(
      and(
        eq(waitlists.tenantId, session.teamId),
        inArray(waitlists.estado, ["activa", "ofrecida"]),
      ),
    )
    .orderBy(desc(waitlists.prioridad), asc(waitlists.createdAt));

  const activas = filas.filter((f) => f.estado === "activa").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Lista de espera"
        description="Cubre huecos de agenda ofreciendo citas a pacientes en espera."
        action={<AgregarDialog />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="En espera activa" value={String(activas)} sub="listas para ofrecer" />
        <Stat
          label="Con email"
          value={String(filas.filter((f) => f.pacienteEmail).length)}
          sub="se pueden notificar"
        />
        <Stat
          label="Prioridad alta (≥8)"
          value={String(filas.filter((f) => f.prioridad >= 8).length)}
          sub="ofrecer primero"
        />
      </div>

      <Card>
        <CardHeader className="p-5 pb-4">
          <CardTitle className="text-sm font-medium">Pacientes en lista de espera</CardTitle>
        </CardHeader>
        {filas.length === 0 ? (
          <EmptyState
            icon={TimerReset}
            title="Lista de espera vacía"
            description="Cuando un paciente quiera un horario que no tienes, agrégalo aquí y ofrécele el hueco cuando se libere."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Celular</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Preferencia</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-sm font-medium">{f.pacienteNombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.pacienteCelular}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.servicioNombre ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {f.preferencia ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={f.prioridad >= 8 ? "red" : f.prioridad >= 5 ? "amber" : "gray"}>
                      P{f.prioridad}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={f.estado === "activa" ? "blue" : "amber"}>
                      {f.estado === "activa" ? "Activa" : "Ofrecida"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <AccionesWaitlist
                      id={f.id}
                      estado={f.estado === "ofrecida" ? "ofrecida" : "activa"}
                      conEmail={Boolean(f.pacienteEmail)}
                      nombre={f.pacienteNombre}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex min-h-[110px] flex-col justify-between rounded-2xl border bg-card p-5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-3">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        <span className="ml-2 text-xs text-muted-foreground">{sub}</span>
      </div>
    </div>
  );
}
