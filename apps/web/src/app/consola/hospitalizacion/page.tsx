import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BedDouble, Lock } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, admissions, bedAssignments, beds, patients } from "@clinicflow/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getSession } from "@/lib/auth";
import { HospitalizacionPanel } from "./hospitalizacion-panel";

export const dynamic = "force-dynamic";

export default async function HospitalizacionPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "hospital.manage")) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Hospitalización"
          description="Gestiona ingresos, camas y evolución de pacientes hospitalizados."
        />
        <Card>
          <EmptyState
            icon={Lock}
            title="Acceso restringido"
            description="Solo el dueño, los odontólogos y las asistentes pueden gestionar hospitalización."
          />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const filasActivas = await db
    .select({
      id: admissions.id,
      nombrePaciente: patients.nombre,
      tipo: admissions.tipo,
      motivo: admissions.motivo,
      admittedAt: admissions.admittedAt,
    })
    .from(admissions)
    .innerJoin(patients, eq(admissions.patientId, patients.id))
    .where(and(eq(admissions.tenantId, session.teamId), eq(admissions.estado, "activa")))
    .orderBy(desc(admissions.admittedAt));

  const camaPorAdmision = new Map<string, string>();
  if (filasActivas.length > 0) {
    const asignaciones = await db
      .select({
        admissionId: bedAssignments.admissionId,
        nombre: beds.nombre,
      })
      .from(bedAssignments)
      .innerJoin(beds, eq(bedAssignments.bedId, beds.id))
      .where(
        and(
          inArray(
            bedAssignments.admissionId,
            filasActivas.map((f) => f.id),
          ),
          isNull(bedAssignments.hasta),
        ),
      );
    for (const a of asignaciones) {
      camaPorAdmision.set(a.admissionId, a.nombre);
    }
  }

  const activas = filasActivas.map((f) => ({
    id: f.id,
    nombrePaciente: f.nombrePaciente,
    tipo: f.tipo,
    motivo: f.motivo,
    cama: camaPorAdmision.get(f.id) ?? null,
    admitidaEl: format(f.admittedAt, "d MMM yyyy, HH:mm", { locale: es }),
  }));

  const filasCamas = await db
    .select({
      id: beds.id,
      nombre: beds.nombre,
      area: beds.area,
      tipo: beds.tipo,
      estado: beds.estado,
      ocupante: patients.nombre,
      admissionId: admissions.id,
    })
    .from(beds)
    .leftJoin(
      bedAssignments,
      and(eq(bedAssignments.bedId, beds.id), isNull(bedAssignments.hasta)),
    )
    .leftJoin(admissions, eq(bedAssignments.admissionId, admissions.id))
    .leftJoin(patients, eq(admissions.patientId, patients.id))
    .where(eq(beds.tenantId, session.teamId))
    .orderBy(asc(beds.nombre));

  const camas = filasCamas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    area: f.area,
    tipo: f.tipo,
    estado: f.estado,
    ocupante: f.ocupante ?? null,
    admissionId: f.admissionId ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Hospitalización"
        description="Panel de camas y admisiones: registra ingresos, asigna camas y controla la ocupación."
      />
      {camas.length === 0 && activas.length === 0 ? (
        <Card>
          <EmptyState
            icon={BedDouble}
            title="Sin camas registradas"
            description="Crea tu primera cama desde este panel para empezar a gestionar hospitalización."
          />
        </Card>
      ) : null}
      <HospitalizacionPanel activas={activas} camas={camas} />
    </div>
  );
}
