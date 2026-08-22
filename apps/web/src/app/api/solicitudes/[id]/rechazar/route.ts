import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, appointments, patients, services } from "@clinicflow/db";
import { canTransition } from "@clinicflow/core";
import { getSession, guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { plantillaRechazoSolicitud } from "@/lib/notify";
import {
  enviarRecordatorio,
  getNotificationSettings,
} from "@/lib/reminder-engine";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const g = await guardStaff("appointments.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const session = (await getSession())!;

  let motivo: string | null = null;
  try {
    const body = (await req.json()) as { motivo?: string };
    motivo = body.motivo?.trim() || null;
  } catch {
    // sin motivo está bien
  }

  const db = getDb();
  const [appt] = await db
    .select({
      id: appointments.id,
      tenantId: appointments.tenantId,
      estado: appointments.estado,
      patientId: appointments.patientId,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      serviceId: appointments.serviceId,
    })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  if (!appt || appt.tenantId !== g.team.id) {
    return NextResponse.json({ error: "no_encontrada" }, { status: 404 });
  }

  if (!canTransition(appt.estado, "cancelada") || appt.estado !== "solicitada") {
    return NextResponse.json(
      { error: `no_se_puede_rechazar_desde_${appt.estado}` },
      { status: 409 },
    );
  }

  await db
    .update(appointments)
    .set({ estado: "cancelada", updatedAt: new Date() })
    .where(eq(appointments.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "solicitud.rechazar",
    entidad: "citas",
    entidadId: id,
    payload: { estado: "cancelada", motivo },
  });

  let email: { enviado: boolean; error?: string; omitido?: string } = { enviado: false };
  try {
    const settings = await getNotificationSettings(g.team.id);
    if (settings && !settings.confirmacionSolicitud) {
      email = { enviado: false, omitido: "notificaciones_desactivadas" };
    } else {
      const [patientRows, serviceRows] = await Promise.all([
        db.select().from(patients).where(eq(patients.id, appt.patientId)).limit(1),
        db
          .select({ nombre: services.nombre })
          .from(services)
          .where(eq(services.id, appt.serviceId))
          .limit(1),
      ]);
      const plantilla = plantillaRechazoSolicitud({
        cita: {
          fecha: appt.fecha,
          horaIni: appt.horaIni,
          servicio: serviceRows[0]?.nombre ?? "",
          clinicaNombre: g.team.name,
          clinicaSlug: g.team.slug,
        },
      });
      const r = await enviarRecordatorio({
        tenantId: g.team.id,
        tipo: "confirmacion_solicitud",
        pacienteId: appt.patientId,
        citaId: appt.id,
        destinatario: patientRows[0]?.email ?? null,
        plantilla,
        enviadoPor: session.userId,
        celularPaciente: patientRows[0]?.celular ?? null,
      });
      email = r.ok ? { enviado: true } : { enviado: false, error: r.error };
    }
  } catch {
    email = { enviado: false, error: "error_notificacion" };
  }

  return NextResponse.json({ ok: true, email });
}
