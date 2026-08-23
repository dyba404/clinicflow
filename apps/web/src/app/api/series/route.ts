import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, appointmentSeries, patients, services, memberships, users } from "@clinicflow/db";
import { guardStaff, guardError, hoyTenant } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { crearSerie, esFrecuencia } from "@/lib/series";
import { normalizarHora } from "@/app/api/citas/solape";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardStaff("appointments.create");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const filas = await getDb()
    .select({
      id: appointmentSeries.id,
      titulo: appointmentSeries.titulo,
      frecuencia: appointmentSeries.frecuencia,
      horaIni: appointmentSeries.horaIni,
      totalSesiones: appointmentSeries.totalSesiones,
      creadas: appointmentSeries.creadas,
      omitidas: appointmentSeries.omitidas,
      estado: appointmentSeries.estado,
      createdAt: appointmentSeries.createdAt,
      paciente: patients.nombre,
      servicio: services.nombre,
      doctor: users.name,
    })
    .from(appointmentSeries)
    .leftJoin(patients, eq(appointmentSeries.patientId, patients.id))
    .leftJoin(services, eq(appointmentSeries.serviceId, services.id))
    .leftJoin(memberships, eq(appointmentSeries.doctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(eq(appointmentSeries.tenantId, g.team.id))
    .orderBy(desc(appointmentSeries.createdAt))
    .limit(100);

  return NextResponse.json({ series: filas });
}

export async function POST(req: Request) {
  const g = await guardStaff("appointments.create");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    patientId?: string;
    serviceId?: string;
    doctorId?: string | null;
    titulo?: string;
    frecuencia?: string;
    fechaInicio?: string;
    horaIni?: string;
    totalSesiones?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const { patientId, serviceId, titulo, frecuencia, fechaInicio } = body;
  if (!patientId || !serviceId || !titulo || !frecuencia || !fechaInicio || !body.horaIni) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
    return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
  }
  const hoy = await hoyTenant(g.team.timezone);
  if (fechaInicio < hoy) {
    return NextResponse.json({ error: "fecha_pasada" }, { status: 400 });
  }
  if (!esFrecuencia(frecuencia)) {
    return NextResponse.json({ error: "frecuencia_invalida" }, { status: 400 });
  }
  const horaIni = normalizarHora(body.horaIni);
  if (!horaIni) {
    return NextResponse.json({ error: "hora_invalida" }, { status: 400 });
  }
  const totalSesiones = Number(body.totalSesiones);
  if (!Number.isInteger(totalSesiones) || totalSesiones < 2 || totalSesiones > 48) {
    return NextResponse.json({ error: "total_sesiones_invalido" }, { status: 400 });
  }
  const nombreTitulo = titulo.trim();
  if (!nombreTitulo || nombreTitulo.length > 80) {
    return NextResponse.json({ error: "titulo_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) return NextResponse.json({ error: "paciente_invalido" }, { status: 404 });

  let doctorId: string | null = body.doctorId ?? null;
  if (g.membership.role === "doctor") {
    doctorId = g.membership.id;
  } else if (doctorId) {
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
    if (!membDoc) return NextResponse.json({ error: "doctor_invalido" }, { status: 400 });
  }

  try {
    const r = await crearSerie({
      tenantId: g.team.id,
      patientId,
      serviceId,
      doctorId,
      titulo: nombreTitulo,
      frecuencia,
      fechaInicio,
      horaIni,
      totalSesiones,
      createdBy: g.user.id,
    });

    void logAuditSesion({
      tenantId: g.team.id,
      accion: "serie.crear",
      entidad: "appointment_series",
      entidadId: r.serieId,
      payload: { creadas: r.creadas, omitidas: r.omitidas },
    });

    return NextResponse.json(
      { ok: true, serieId: r.serieId, creadas: r.creadas, omitidas: r.omitidas },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
