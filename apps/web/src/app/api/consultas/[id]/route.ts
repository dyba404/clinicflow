import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { hasPermission } from "@clinicflow/core";
import { getDb, consultations } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff();
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    motivoConsulta?: string;
    subjetivo?: string;
    objetivo?: string;
    evaluacion?: string;
    plan?: string;
    constantes?: Record<string, unknown>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [consulta] = await db
    .select({
      id: consultations.id,
      creadoPor: consultations.creadoPor,
    })
    .from(consultations)
    .where(and(eq(consultations.id, id), eq(consultations.tenantId, g.team.id)))
    .limit(1);
  if (!consulta) {
    return NextResponse.json({ error: "consulta_no_encontrada" }, { status: 404 });
  }

  if (!hasPermission(g.membership.role, "records.edit") && consulta.creadoPor !== g.user.id) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  const cambios: Partial<typeof consultations.$inferInsert> = {};
  if (typeof body.motivoConsulta !== "undefined") {
    cambios.motivoConsulta = body.motivoConsulta.trim() || null;
  }
  if (typeof body.subjetivo !== "undefined") {
    cambios.subjetivo = body.subjetivo.trim() || null;
  }
  if (typeof body.objetivo !== "undefined") {
    cambios.objetivo = body.objetivo.trim() || null;
  }
  if (typeof body.evaluacion !== "undefined") {
    cambios.evaluacion = body.evaluacion.trim() || null;
  }
  if (typeof body.plan !== "undefined") {
    cambios.plan = body.plan.trim() || null;
  }
  if (typeof body.constantes !== "undefined") {
    cambios.constantes = body.constantes;
  }
  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const [row] = await db
    .update(consultations)
    .set({ ...cambios, updatedAt: new Date() })
    .where(and(eq(consultations.id, id), eq(consultations.tenantId, g.team.id)))
    .returning({ id: consultations.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "consulta.editar",
    entidad: "consultations",
    entidadId: id,
    payload: { campos: Object.keys(cambios) },
  });

  return NextResponse.json({ ok: true, id: row!.id });
}
