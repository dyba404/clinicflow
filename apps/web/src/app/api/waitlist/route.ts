import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, waitlists, patients, services } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardStaff("waitlist.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const rows = await getDb()
    .select({
      id: waitlists.id,
      patientId: waitlists.patientId,
      serviceId: waitlists.serviceId,
      preferencia: waitlists.preferencia,
      prioridad: waitlists.prioridad,
      estado: waitlists.estado,
      createdAt: waitlists.createdAt,
      pacienteNombre: patients.nombre,
      pacienteCelular: patients.celular,
      pacienteEmail: patients.email,
      servicioNombre: services.nombre,
    })
    .from(waitlists)
    .innerJoin(patients, eq(waitlists.patientId, patients.id))
    .leftJoin(services, eq(waitlists.serviceId, services.id))
    .where(and(eq(waitlists.tenantId, g.team.id), eq(waitlists.estado, "activa")))
    .orderBy(desc(waitlists.prioridad), asc(waitlists.createdAt));

  return NextResponse.json({ waitlist: rows });
}

export async function POST(req: Request) {
  const g = await guardStaff("waitlist.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    patientId?: string;
    serviceId?: string | null;
    preferencia?: string | null;
    prioridad?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const patientId = body.patientId?.trim();
  if (!patientId) {
    return NextResponse.json({ error: "paciente_requerido" }, { status: 400 });
  }

  const prioridad = body.prioridad === undefined ? 5 : Number(body.prioridad);
  if (!Number.isInteger(prioridad) || prioridad < 1 || prioridad > 10) {
    return NextResponse.json({ error: "prioridad_invalida" }, { status: 400 });
  }

  const preferencia = body.preferencia?.trim() || null;
  if (preferencia && preferencia.length > 200) {
    return NextResponse.json({ error: "preferencia_invalida" }, { status: 400 });
  }

  const db = getDb();

  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  let serviceId: string | null = null;
  if (body.serviceId) {
    const [servicio] = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.id, body.serviceId), eq(services.tenantId, g.team.id)))
      .limit(1);
    if (!servicio) {
      return NextResponse.json({ error: "servicio_no_encontrado" }, { status: 404 });
    }
    serviceId = servicio.id;
  }

  const [existente] = await db
    .select()
    .from(waitlists)
    .where(
      and(
        eq(waitlists.tenantId, g.team.id),
        eq(waitlists.patientId, patientId),
        eq(waitlists.estado, "activa"),
      ),
    )
    .limit(1);
  if (existente) {
    return NextResponse.json({ ok: true, duplicado: true, waitlist: existente }, { status: 200 });
  }

  const [row] = await db
    .insert(waitlists)
    .values({
      tenantId: g.team.id,
      patientId,
      serviceId,
      preferencia,
      prioridad,
      estado: "activa",
    })
    .returning();

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "waitlist.agregar",
    entidad: "waitlists",
    entidadId: row!.id,
    payload: { patientId, serviceId, prioridad },
  });

  return NextResponse.json({ ok: true, waitlist: row }, { status: 201 });
}
