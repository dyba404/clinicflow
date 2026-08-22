import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, dataRequests, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TIPOS = ["acceso", "rectificacion", "cancelacion", "oposicion"] as const;

export async function GET() {
  const g = await guardStaff("reports.view_all");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const filas = await getDb()
    .select({
      id: dataRequests.id,
      tipo: dataRequests.tipo,
      estado: dataRequests.estado,
      detalle: dataRequests.detalle,
      createdAt: dataRequests.createdAt,
      patientId: dataRequests.patientId,
      patientNombre: patients.nombre,
    })
    .from(dataRequests)
    .leftJoin(patients, eq(dataRequests.patientId, patients.id))
    .where(eq(dataRequests.tenantId, g.team.id))
    .orderBy(desc(dataRequests.createdAt));

  return NextResponse.json({ solicitudes: filas });
}

export async function POST(req: Request) {
  const g = await guardStaff("reports.view_all");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { patientId?: string; tipo?: string; detalle?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const patientId = body.patientId?.trim();
  if (!patientId) {
    return NextResponse.json({ error: "paciente_requerido" }, { status: 400 });
  }
  if (!TIPOS.includes(body.tipo as (typeof TIPOS)[number])) {
    return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
  }
  const detalle = body.detalle?.trim() ? body.detalle.trim().slice(0, 500) : null;

  const [paciente] = await getDb()
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  const [row] = await getDb()
    .insert(dataRequests)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      tipo: body.tipo as string,
      estado: "pendiente",
      detalle,
    })
    .returning({ id: dataRequests.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "arco.crear",
    entidad: "data_requests",
    entidadId: row!.id,
    payload: { patientId: paciente.id, tipo: body.tipo, detalle },
  });

  return NextResponse.json({ ok: true, id: row!.id }, { status: 201 });
}
