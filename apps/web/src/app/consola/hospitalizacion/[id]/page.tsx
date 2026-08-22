import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BedDouble } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  getDb,
  admissions,
  bedAssignments,
  beds,
  evolutions,
  memberships,
  patients,
  users,
} from "@clinicflow/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { getSession } from "@/lib/auth";
import { AdmisionDetalle } from "./admision-detalle";

export const dynamic = "force-dynamic";

export default async function AdmisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "hospital.manage")) {
    redirect("/consola/hospitalizacion");
  }

  const db = getDb();
  const [admision] = await db
    .select({
      id: admissions.id,
      tipo: admissions.tipo,
      motivo: admissions.motivo,
      estado: admissions.estado,
      admittedAt: admissions.admittedAt,
      dischargedAt: admissions.dischargedAt,
      altaTipo: admissions.altaTipo,
      epicrisis: admissions.epicrisis,
      nombrePaciente: patients.nombre,
      doctorNombre: users.name,
    })
    .from(admissions)
    .innerJoin(patients, eq(admissions.patientId, patients.id))
    .leftJoin(users, eq(admissions.admittedById, users.id))
    .where(and(eq(admissions.id, id), eq(admissions.tenantId, session.teamId)))
    .limit(1);

  if (!admision) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Admisión" />
        <Card>
          <EmptyState
            icon={BedDouble}
            title="Admisión no encontrada"
            description="La admisión no existe o pertenece a otra clínica."
            action={
              <Link
                href="/consola/hospitalizacion"
                className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Volver al panel
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const [camaActual] = await db
    .select({ nombre: beds.nombre, area: beds.area, tipo: beds.tipo })
    .from(bedAssignments)
    .innerJoin(beds, eq(bedAssignments.bedId, beds.id))
    .where(and(eq(bedAssignments.admissionId, id), isNull(bedAssignments.hasta)))
    .limit(1);

  const filasCamas = await db
    .select({ id: beds.id, nombre: beds.nombre, area: beds.area, tipo: beds.tipo })
    .from(beds)
    .where(and(eq(beds.tenantId, session.teamId), eq(beds.estado, "libre")))
    .orderBy(beds.nombre);

  const filasEvoluciones = await db
    .select({
      id: evolutions.id,
      fecha: evolutions.fecha,
      nota: evolutions.nota,
      nombreDoctor: users.name,
      createdAt: evolutions.createdAt,
    })
    .from(evolutions)
    .leftJoin(memberships, eq(evolutions.doctorMembershipId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(eq(evolutions.admissionId, id))
    .orderBy(desc(evolutions.fecha), desc(evolutions.createdAt));

  const detalle = {
    id: admision.id,
    nombrePaciente: admision.nombrePaciente,
    tipo: admision.tipo,
    motivo: admision.motivo,
    estado: admision.estado,
    admitidaEl: format(admision.admittedAt, "d MMM yyyy, HH:mm", { locale: es }),
    dischargedAt: admision.dischargedAt
      ? format(admision.dischargedAt, "d MMM yyyy, HH:mm", { locale: es })
      : null,
    altaTipo: admision.altaTipo,
    epicrisis: admision.epicrisis,
    doctorNombre: admision.doctorNombre,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={`Admisión · ${admision.nombrePaciente}`}
        description="Detalle de la admisión: cama, evoluciones y alta."
        action={
          <Link
            href={`/consola/hospitalizacion/${id}/signos`}
            className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Signos vitales
          </Link>
        }
      />
      <AdmisionDetalle
        admision={detalle}
        cama={camaActual ?? null}
        camasLibres={filasCamas}
        evoluciones={filasEvoluciones.map((e) => ({
          id: e.id,
          fecha: e.fecha,
          nota: e.nota,
          nombreDoctor: e.nombreDoctor ?? null,
        }))}
      />
    </div>
  );
}
