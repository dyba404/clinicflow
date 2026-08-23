import { redirect } from "next/navigation";
import { hasPermission } from "@clinicflow/core";
import { desc, eq } from "drizzle-orm";
import {
  getDb,
  appointmentSeries,
  patients,
  services,
  memberships,
  users,
} from "@clinicflow/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { Lock, Repeat } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession } from "@/lib/auth";
import { getDefaultTeam, doctoresConColor, pacientesBasicos } from "@/lib/console-data";
import { NuevaSerieDialog } from "./nueva-serie-dialog";
import { CancelarSerieButton } from "./cancelar-serie-button";

export const dynamic = "force-dynamic";

const ESTADO_LABEL: Record<string, string> = {
  activa: "Activa",
  completada: "Completada",
  cancelada: "Cancelada",
};

const FRECUENCIA_LABEL: Record<string, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
};

async function seriesDeTeam(teamId: string) {
  const db = getDb();
  return db
    .select({
      id: appointmentSeries.id,
      titulo: appointmentSeries.titulo,
      frecuencia: appointmentSeries.frecuencia,
      horaIni: appointmentSeries.horaIni,
      totalSesiones: appointmentSeries.totalSesiones,
      creadas: appointmentSeries.creadas,
      omitidas: appointmentSeries.omitidas,
      estado: appointmentSeries.estado,
      paciente: patients.nombre,
      servicio: services.nombre,
      doctor: users.name,
    })
    .from(appointmentSeries)
    .leftJoin(patients, eq(appointmentSeries.patientId, patients.id))
    .leftJoin(services, eq(appointmentSeries.serviceId, services.id))
    .leftJoin(memberships, eq(appointmentSeries.doctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(eq(appointmentSeries.tenantId, teamId))
    .orderBy(desc(appointmentSeries.createdAt))
    .limit(100);
}

export default async function SeriesPage() {
  const [team, session] = await Promise.all([getDefaultTeam(), getSession()]);
  if (!team || !session) redirect("/login");

  if (!hasPermission(session.role, "appointments.create")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Series de citas"
          description="Citas recurrentes para tratamientos multi-sesión y controles."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Tu rol no tiene permiso para crear series de citas."
          />
        </Card>
      </div>
    );
  }

  const [doctores, pacientes, filas] = await Promise.all([
    doctoresConColor(team.id),
    pacientesBasicos(team.id),
    seriesDeTeam(team.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Series de citas"
        description="Citas recurrentes para tratamientos multi-sesión y controles."
        action={
          <NuevaSerieDialog teamSlug={team.slug} doctores={doctores} pacientes={pacientes} />
        }
      />

      {filas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Repeat}
            title="Aún no hay series"
            description="Crea una serie para agendar citas recurrentes (controles, terapias, etc.)."
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serie</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead className="text-center">Frecuencia</TableHead>
                <TableHead className="text-center">Sesiones</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{f.titulo}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">{f.horaIni}</p>
                  </TableCell>
                  <TableCell className="text-sm">{f.paciente ?? "—"}</TableCell>
                  <TableCell className="text-sm">{f.servicio ?? "—"}</TableCell>
                  <TableCell className="text-sm">{f.doctor ?? "Sin asignar"}</TableCell>
                  <TableCell className="text-center text-sm">
                    {FRECUENCIA_LABEL[f.frecuencia] ?? f.frecuencia}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {f.creadas}/{f.totalSesiones}
                    {f.omitidas > 0 ? (
                      <span className="ml-1 text-xs text-amber-600">({f.omitidas} omitidas)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={f.estado === "activa" ? "green" : "gray"}>
                      {ESTADO_LABEL[f.estado] ?? f.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {f.estado === "activa" ? <CancelarSerieButton serieId={f.id} /> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
