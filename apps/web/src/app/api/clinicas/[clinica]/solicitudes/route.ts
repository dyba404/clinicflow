import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import {
  getDb,
  appointments,
  patients,
  services,
  signedConsents,
  teams,
} from "@clinicflow/db";
import { isSlotStillFree } from "@/lib/db";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export interface RequestPayload {
  serviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  doctorMembershipId?: string | null;
  nombre: string;
  celular: string;
  email?: string;
  notas?: string;
  consentimiento?: boolean;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ clinica: string }> },
) {
  const { clinica } = await params;

  const limite = rateLimit(`solicitud-publica:${ipReq(req)}`, 10);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  let payload: RequestPayload;
  try {
    payload = (await req.json()) as RequestPayload;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const { serviceId, date, startTime, endTime, doctorMembershipId, nombre, celular, email, notas, consentimiento } = payload;

  if (!serviceId || !date || !startTime || !endTime || !nombre || !celular) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }
  if (consentimiento !== true) {
    return NextResponse.json({ error: "consentimiento_requerido" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return NextResponse.json({ error: "formato_invalido" }, { status: 400 });
  }
  const telNorm = celular.replace(/\s+/g, "");
  if (!/^\+?[0-9]{7,15}$/.test(telNorm)) {
    return NextResponse.json({ error: "celular_invalido" }, { status: 400 });
  }

  const db = getDb();

  const teamRows = await db.select({ id: teams.id }).from(teams).where(eq(teams.slug, clinica)).limit(1);
  const team = teamRows[0];
  if (!team) {
    return NextResponse.json({ error: "clinica_no_encontrada" }, { status: 404 });
  }

  const svcRows = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.tenantId, team.id), eq(services.activo, true)))
    .limit(1);
  const service = svcRows[0];
  if (!service) {
    return NextResponse.json({ error: "servicio_invalido" }, { status: 400 });
  }

  const libre = await isSlotStillFree(team.id, {
    date,
    startTime,
    endTime,
    serviceId,
  });
  if (!libre) {
    return NextResponse.json({ error: "slot_no_disponible" }, { status: 409 });
  }

  let patient;
  const existing = await db
    .select()
    .from(patients)
    .where(and(eq(patients.tenantId, team.id), eq(patients.celular, telNorm)))
    .limit(1);
  patient = existing[0];
  if (!patient) {
    const created = await db
      .insert(patients)
      .values({
        tenantId: team.id,
        nombre: nombre.trim(),
        celular: telNorm,
        email: email?.trim() || null,
      })
      .returning();
    patient = created[0]!;
  }

  let appt;
  try {
    [appt] = await db
      .insert(appointments)
      .values({
        tenantId: team.id,
        serviceId: service.id,
        patientId: patient.id,
        doctorId: doctorMembershipId || null,
        preferredDoctorId: doctorMembershipId || null,
        fecha: date,
        horaIni: startTime,
        horaFin: endTime,
        estado: "solicitada",
        modoSolicitud: true,
        monto: service.precio,
        notas: notas?.trim() || null,
      })
      .returning();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const constraint = (e as { constraint_name?: string } | null)?.constraint_name ?? "";
    if (/appointments_no_overlap/i.test(`${msg} ${constraint}`)) {
      return NextResponse.json({ error: "horario_ocupado" }, { status: 409 });
    }
    throw e;
  }
  if (!appt) {
    return NextResponse.json({ error: "no_se_pudo_crear" }, { status: 500 });
  }

  const [consent] = await db
    .insert(signedConsents)
    .values({
      tenantId: team.id,
      patientId: patient.id,
      citaId: appt.id,
      servicioNombre: service.nombre,
      signedBy: patient.nombre,
      signedAt: new Date(),
    })
    .returning({ id: signedConsents.id });

  void logAudit({
    tenantId: team.id,
    accion: "consentimiento.registro_publico",
    entidad: "signed_consents",
    entidadId: consent?.id,
    payload: { servicioNombre: service.nombre, via: "wizard_reserva" },
  });

  return NextResponse.json(
    {
      ok: true,
      cita: {
        id: appt.id,
        fecha: date,
        horaIni: startTime,
        horaFin: endTime,
        estado: appt.estado,
      },
    },
    { status: 201 },
  );
}
