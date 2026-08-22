import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, and } from "drizzle-orm";
import { Stethoscope } from "lucide-react";
import { hasPermission } from "@clinicflow/core";
import {
  getDb,
  appointments,
  patients,
  services,
  memberships,
  users,
  consultations,
  consultDiagnoses,
  cie10,
  prescriptions,
  orders,
} from "@clinicflow/db";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { EmptyState } from "@/components/console/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { getSession } from "@/lib/auth";
import { ConsultaAtencion } from "./consulta-form";

export const dynamic = "force-dynamic";

export default async function AtencionPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const db = getDb();
  const [cita] = await db
    .select({
      id: appointments.id,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      estado: appointments.estado,
      patientId: appointments.patientId,
      pacienteNombre: patients.nombre,
      servicioNombre: services.nombre,
      doctorNombre: users.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(memberships, eq(appointments.doctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.tenantId, session.teamId)))
    .limit(1);

  if (!cita) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <EmptyState
            icon={Stethoscope}
            title="Cita no encontrada"
            description="La cita no existe o pertenece a otra clínica."
            action={
              <Link
                href="/consola/agenda"
                className="inline-flex h-8 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Volver a la agenda
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  if (!hasPermission(session.role, "records.view")) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Atención" description={cita.pacienteNombre} />
        <Card>
          <EmptyState
            icon={Stethoscope}
            title="Acceso restringido"
            description="Solo los roles con acceso a registros clínicos pueden atender citas."
          />
        </Card>
      </div>
    );
  }

  const [consulta] = await db
    .select()
    .from(consultations)
    .where(
      and(
        eq(consultations.appointmentId, appointmentId),
        eq(consultations.tenantId, session.teamId),
      ),
    )
    .orderBy(desc(consultations.createdAt))
    .limit(1);

  let consultaInicial: {
    id: string;
    motivoConsulta: string | null;
    subjetivo: string | null;
    objetivo: string | null;
    evaluacion: string | null;
    plan: string | null;
    constantes: Record<string, string> | null;
    diagnosticos: Array<{ codigo: string; descripcion: string | null; esPrincipal: boolean }>;
    recetas: Array<{
      id: string;
      medicamento: string;
      dosis: string | null;
      frecuencia: string | null;
      duracionDias: number | null;
      indicaciones: string | null;
    }>;
  } | null = null;

  if (consulta) {
    const [diagnosticos, recetas] = await Promise.all([
      db
        .select({
          codigo: consultDiagnoses.cie10Codigo,
          descripcion: cie10.descripcion,
          esPrincipal: consultDiagnoses.esPrincipal,
        })
        .from(consultDiagnoses)
        .leftJoin(cie10, eq(consultDiagnoses.cie10Codigo, cie10.codigo))
        .where(eq(consultDiagnoses.consultationId, consulta.id)),
      db
        .select({
          id: prescriptions.id,
          medicamento: prescriptions.medicamento,
          dosis: prescriptions.dosis,
          frecuencia: prescriptions.frecuencia,
          duracionDias: prescriptions.duracionDias,
          indicaciones: prescriptions.indicaciones,
        })
        .from(prescriptions)
        .where(eq(prescriptions.consultationId, consulta.id)),
    ]);
    consultaInicial = {
      id: consulta.id,
      motivoConsulta: consulta.motivoConsulta,
      subjetivo: consulta.subjetivo,
      objetivo: consulta.objetivo,
      evaluacion: consulta.evaluacion,
      plan: consulta.plan,
      constantes: (consulta.constantes ?? null) as Record<string, string> | null,
      diagnosticos,
      recetas,
    };
  }

  const ordenesIniciales = await db
    .select({
      id: orders.id,
      tipo: orders.tipo,
      nombre: orders.nombre,
      indicacion: orders.indicacion,
      estado: orders.estado,
      prioridad: orders.prioridad,
    })
    .from(orders)
    .where(and(eq(orders.appointmentId, appointmentId), eq(orders.tenantId, session.teamId)))
    .orderBy(desc(orders.prioridad), desc(orders.createdAt));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Atención" description={cita.pacienteNombre} />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
          <span className="text-sm font-semibold">{cita.pacienteNombre}</span>
          <span className="text-sm text-muted-foreground">
            {cita.servicioNombre}
            {cita.doctorNombre ? ` · ${cita.doctorNombre}` : ""}
          </span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {cita.fecha} · {cita.horaIni}
          </span>
          <span className="ml-auto">
            <StatusBadge status={cita.estado} />
          </span>
        </CardContent>
      </Card>

      <ConsultaAtencion
        patientId={cita.patientId}
        appointmentId={appointmentId}
        consultaInicial={consultaInicial}
        ordenesIniciales={ordenesIniciales}
        puedeCrearOrdenes={hasPermission(session.role, "labs.manage")}
      />
    </div>
  );
}
