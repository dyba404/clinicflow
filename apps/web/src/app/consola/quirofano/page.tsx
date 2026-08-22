import { redirect } from "next/navigation";
import { Lock, Scissors } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  getDb,
  memberships,
  patients,
  surgeries,
  surgeryRooms,
  users,
} from "@clinicflow/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getSession, hoyTenant } from "@/lib/auth";
import { QuirofanoPanel } from "./quirofano-panel";

export const dynamic = "force-dynamic";

export default async function QuirofanoPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "surgery.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Quirófano"
          description="Programa cirugías, asigna salas y controla el flujo de cada procedimiento."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el dueño puede gestionar el módulo de quirófano."
          />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const hoy = await hoyTenant(session.teamTimezone);

  const salas = await db
    .select({ id: surgeryRooms.id, nombre: surgeryRooms.nombre, activo: surgeryRooms.activo })
    .from(surgeryRooms)
    .where(eq(surgeryRooms.tenantId, session.teamId))
    .orderBy(asc(surgeryRooms.nombre));

  const cirujanoM = alias(memberships, "consola_cirujano_m");
  const anestM = alias(memberships, "consola_anest_m");
  const cirujanoU = alias(users, "consola_cirujano_u");
  const anestU = alias(users, "consola_anest_u");

  const desde = new Date(`${hoy}T00:00:00`);
  const hasta = new Date(desde.getTime() + 24 * 3600_000);

  const filas = await db
    .select({
      id: surgeries.id,
      nombrePaciente: patients.nombre,
      roomId: surgeries.roomId,
      nombreSala: surgeryRooms.nombre,
      scheduledAt: surgeries.scheduledAt,
      procedimiento: surgeries.procedimiento,
      cirujanoNombre: cirujanoU.name,
      anestesiologoNombre: anestU.name,
      asaClase: surgeries.asaClase,
      estado: surgeries.estado,
      checklistPreop: surgeries.checklistPreop,
      complicaciones: surgeries.complicaciones,
      urpaNotas: surgeries.urpaNotas,
      canceladaMotivo: surgeries.canceladaMotivo,
      inicioAt: surgeries.inicioAt,
      finAt: surgeries.finAt,
    })
    .from(surgeries)
    .innerJoin(patients, eq(surgeries.patientId, patients.id))
    .leftJoin(surgeryRooms, eq(surgeries.roomId, surgeryRooms.id))
    .leftJoin(cirujanoM, eq(surgeries.cirujanoMembershipId, cirujanoM.id))
    .leftJoin(cirujanoU, eq(cirujanoM.userId, cirujanoU.id))
    .leftJoin(anestM, eq(surgeries.anestesiologoMembershipId, anestM.id))
    .leftJoin(anestU, eq(anestM.userId, anestU.id))
    .where(
      and(
        eq(surgeries.tenantId, session.teamId),
        gte(surgeries.scheduledAt, desde),
        lt(surgeries.scheduledAt, hasta),
      ),
    )
    .orderBy(asc(surgeries.scheduledAt));

  const horaFmt = new Intl.DateTimeFormat("es-PE", {
    timeZone: session.teamTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const cirugias = filas.map((f) => ({
    id: f.id,
    nombrePaciente: f.nombrePaciente,
    roomId: f.roomId,
    nombreSala: f.nombreSala ?? null,
    hora: horaFmt.format(new Date(f.scheduledAt)),
    procedimiento: f.procedimiento,
    cirujanoNombre: f.cirujanoNombre ?? null,
    asaClase: f.asaClase,
    estado: f.estado,
    checklistPreop: Array.isArray(f.checklistPreop) ? (f.checklistPreop as boolean[]) : null,
    canceladaMotivo: f.canceladaMotivo ?? null,
  }));

  const doctores = await db
    .select({ membershipId: memberships.id, nombre: users.name })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.teamId, session.teamId),
        eq(memberships.role, "doctor"),
        eq(memberships.active, true),
      ),
    )
    .orderBy(asc(users.name));

  const total = cirugias.length;
  const completadas = cirugias.filter((c) => c.estado === "completada").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Quirófano"
        description="Programación de cirugías: salas, checklist preoperatorio y seguimiento por estado."
      />
      {salas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Scissors}
            title="Sin salas registradas"
            description="Crea tu primera sala de operaciones para empezar a programar cirugías."
          />
        </Card>
      ) : null}
      <QuirofanoPanel
        hoy={hoy}
        total={total}
        completadas={completadas}
        salas={salas}
        cirugias={cirugias}
        doctores={doctores.map((d) => ({ id: d.membershipId, nombre: d.nombre }))}
      />
    </div>
  );
}
