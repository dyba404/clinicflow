import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, appointments, appointmentStatusEvents } from "@clinicflow/db";
import { canTransition, assertTransition } from "@clinicflow/core";
import type { AppointmentStatus, Permission } from "@clinicflow/core";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { consumirMateriales } from "@/lib/inventario";
import { ofrecerHuecoAutomatico } from "@/lib/hueco";
import { resenaAutomaticaSiAplica } from "@/lib/reviews";
import { recuperacionNoShow } from "@/lib/no-show";

const VALID: AppointmentStatus[] = [
  "solicitada",
  "confirmada",
  "en_espera",
  "en_atencion",
  "atendida",
  "no_show",
  "cancelada",
];

function permisoParaEstado(estado: AppointmentStatus): Permission {
  switch (estado) {
    case "en_espera":
      return "checkin.perform";
    case "en_atencion":
    case "atendida":
      return "records.edit";
    case "cancelada":
    case "no_show":
      return "appointments.edit";
    default:
      return "appointments.edit";
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let estado: AppointmentStatus;
  try {
    const body = (await req.json()) as { estado?: string };
    estado = body.estado as AppointmentStatus;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!VALID.includes(estado)) {
    return NextResponse.json({ error: "estado_desconocido" }, { status: 400 });
  }

  const g = await guardStaff(permisoParaEstado(estado));
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [appt] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  if (!appt || appt.tenantId !== g.team.id) {
    return NextResponse.json({ error: "no_encontrada" }, { status: 404 });
  }

  if (g.membership.role === "doctor" && appt.doctorId !== g.membership.id) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  if (!canTransition(appt.estado, estado)) {
    return NextResponse.json(
      { error: `no_se_puede_pasar_de_${appt.estado}_a_${estado}` },
      { status: 409 },
    );
  }

  assertTransition(appt.estado, estado);
  const eraConfirmada = appt.estado === "confirmada";
  let faltantes: string[] = [];
  await db
    .update(appointments)
    .set({ estado, updatedAt: new Date() })
    .where(eq(appointments.id, id));

  await db.insert(appointmentStatusEvents).values({
    tenantId: g.team.id,
    appointmentId: id,
    estadoFrom: appt.estado,
    estadoTo: estado,
    changedBy: g.user.id,
  });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cita.estado",
    entidad: "citas",
    entidadId: id,
    payload: { estado },
  });

  if (estado === "atendida") {
    const consumo = await consumirMateriales(g.team.id, id).catch(() => ({
      consumido: false,
      faltantes: [] as string[],
    }));
    faltantes = consumo.faltantes;

    void resenaAutomaticaSiAplica({
      tenantId: g.team.id,
      appointmentId: id,
      patientId: appt.patientId,
    });
  }

  if (estado === "cancelada" && eraConfirmada) {
    void ofrecerHuecoAutomatico({
      tenantId: g.team.id,
      tenantNombre: g.team.name,
      tenantSlug: g.team.slug,
      citaId: id,
      fecha: appt.fecha,
      horaIni: appt.horaIni,
      via: "consola",
    }).catch(() => {});
  }

  if (estado === "no_show") {
    void recuperacionNoShow({
      tenantId: g.team.id,
      tenantNombre: g.team.name,
      tenantSlug: g.team.slug,
      citaId: id,
      patientId: appt.patientId,
      enviadoPor: g.user.id,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, estado, faltantes });
}
