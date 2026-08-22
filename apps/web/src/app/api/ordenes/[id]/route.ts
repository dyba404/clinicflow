import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, orders, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff();
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [row] = await db
    .select({
      id: orders.id,
      patientId: orders.patientId,
      nombrePaciente: patients.nombre,
      celularPaciente: patients.celular,
      appointmentId: orders.appointmentId,
      consultationId: orders.consultationId,
      tipo: orders.tipo,
      nombre: orders.nombre,
      indicacion: orders.indicacion,
      estado: orders.estado,
      prioridad: orders.prioridad,
      resultado: orders.resultado,
      resultadoAt: orders.resultadoAt,
      motivoRevision: orders.motivoRevision,
      rev: orders.rev,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .innerJoin(patients, eq(orders.patientId, patients.id))
    .where(and(eq(orders.id, id), eq(orders.tenantId, g.team.id)))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "orden_no_encontrada" }, { status: 404 });
  }

  return NextResponse.json({ orden: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("labs.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { resultado?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (typeof body.resultado === "undefined" || body.resultado === null) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [orden] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, g.team.id)))
    .limit(1);
  if (!orden) {
    return NextResponse.json({ error: "orden_no_encontrada" }, { status: 404 });
  }

  const [row] = await db
    .update(orders)
    .set({
      resultado: body.resultado as Record<string, unknown>,
      resultadoAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, id), eq(orders.tenantId, g.team.id)))
    .returning({ id: orders.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "orden.resultado",
    entidad: "orders",
    entidadId: id,
  });

  return NextResponse.json({ ok: true, id: row!.id });
}
