import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, appointments, services, memberships, patients } from "@clinicflow/db";
import { guardStaff, guardError, getSession } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { ensureMagicToken, magicUrl } from "@/lib/magic-link";
import { plantillaReprogramacionSolicitud } from "@/lib/notify";
import { enviarRecordatorio } from "@/lib/reminder-engine";
import { horaFinDesde, horarioOcupado, normalizarHora } from "../../solape";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const g = await guardStaff("appointments.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { fecha?: string; horaIni?: string; doctorId?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  if (!appt || appt.tenantId !== g.team.id) {
    return NextResponse.json({ error: "no_encontrada" }, { status: 404 });
  }

  if (g.membership.role === "doctor" && appt.doctorId !== g.membership.id) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  const desdeTerminal = appt.estado === "cancelada" || appt.estado === "no_show";
  if (!["solicitada", "confirmada", "cancelada", "no_show"].includes(appt.estado)) {
    return NextResponse.json(
      { error: `no_se_puede_reprogramar_en_${appt.estado}` },
      { status: 409 },
    );
  }

  const fecha = body.fecha ?? appt.fecha;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
  }
  const doctorId = body.doctorId === undefined ? appt.doctorId : body.doctorId ?? null;
  const horaIni = normalizarHora(body.horaIni ?? appt.horaIni);
  if (!horaIni) {
    return NextResponse.json({ error: "hora_invalida" }, { status: 400 });
  }

  if (doctorId) {
    const [membDoc] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, doctorId),
          eq(memberships.teamId, g.team.id),
          eq(memberships.role, "doctor"),
          eq(memberships.active, true),
        ),
      )
      .limit(1);
    if (!membDoc) {
      return NextResponse.json({ error: "doctor_invalido" }, { status: 400 });
    }
  }

  const [service] = await db
    .select({ duracionMin: services.duracionMin })
    .from(services)
    .where(and(eq(services.id, appt.serviceId), eq(services.tenantId, g.team.id)))
    .limit(1);
  const duracionMin = service?.duracionMin ?? 30;
  const horaFin = horaFinDesde(horaIni, duracionMin);
  if (!horaFin) {
    return NextResponse.json({ error: "hora_invalida" }, { status: 400 });
  }

  if (doctorId) {
    const ocupado = await horarioOcupado({
      tenantId: g.team.id,
      fecha,
      horaIni,
      horaFin,
      doctorId,
      excluirCitaId: appt.id,
    });
    if (ocupado) {
      return NextResponse.json({ error: "horario_ocupado" }, { status: 409 });
    }
  }

  let updated;
  const nuevoEstado = desdeTerminal ? "solicitada" : appt.estado;
  try {
    [updated] = await db
      .update(appointments)
      .set({
        fecha,
        horaIni,
        horaFin,
        doctorId,
        preferredDoctorId: doctorId,
        estado: nuevoEstado,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();
  } catch (e) {
    if (e instanceof Error && /appointments_no_overlap/i.test(e.message)) {
      return NextResponse.json({ error: "horario_ocupado" }, { status: 409 });
    }
    throw e;
  }
  if (!updated) {
    return NextResponse.json({ error: "no_se_pudo_actualizar" }, { status: 500 });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cita.reprogramar",
    entidad: "citas",
    entidadId: id,
    payload: { fecha, horaIni, estado: nuevoEstado, desde: appt.estado },
  });

  let email: { enviado: boolean; error?: string } = { enviado: false };
  try {
    const session = await getSession();
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, appt.patientId))
      .limit(1);
    const [service] = await db
      .select({ nombre: services.nombre })
      .from(services)
      .where(and(eq(services.id, appt.serviceId), eq(services.tenantId, g.team.id)))
      .limit(1);
    const token = patient ? await ensureMagicToken(g.team.id, patient.id, appt.id) : null;
    const plantilla = plantillaReprogramacionSolicitud({
      cita: {
        fecha,
        horaIni,
        servicio: service?.nombre ?? "",
        clinicaNombre: g.team.name,
        clinicaSlug: g.team.slug,
      },
      magicUrl: token ? magicUrl(g.team.slug, token) : null,
    });
    const r = await enviarRecordatorio({
      tenantId: g.team.id,
      tipo: "reprogramacion",
      pacienteId: appt.patientId,
      citaId: appt.id,
      destinatario: patient?.email ?? null,
      plantilla,
      enviadoPor: session?.userId ?? null,
      celularPaciente: patient?.celular ?? null,
    });
    email = r.ok ? { enviado: true } : { enviado: false, error: r.error };
  } catch {
    email = { enviado: false, error: "error_notificacion" };
  }

  return NextResponse.json({ ok: true, estado: nuevoEstado, reactivada: desdeTerminal, email });
}
