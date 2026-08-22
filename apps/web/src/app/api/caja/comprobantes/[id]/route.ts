import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, receipts } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { serie?: string; correlativo?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [comp] = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)))
    .limit(1);
  if (!comp) {
    return NextResponse.json({ error: "comprobante_no_encontrado" }, { status: 404 });
  }
  if (comp.sunatEstado !== "manual") {
    return NextResponse.json(
      { error: "solo_se_pueden_editar_comprobantes_manuales" },
      { status: 409 },
    );
  }

  const updates: { serie?: string; correlativo?: number } = {};
  if (typeof body.serie === "string" && body.serie.trim()) {
    updates.serie = body.serie.trim();
  }
  const correlativo = Number(body.correlativo);
  if (Number.isInteger(correlativo) && correlativo >= 1) {
    updates.correlativo = correlativo;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "sin_cambios" }, { status: 400 });
  }

  try {
    await db
      .update(receipts)
      .set(updates)
      .where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)));
  } catch {
    return NextResponse.json({ error: "correlativo_ocupado" }, { status: 409 });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "comprobante.editar",
    entidad: "receipts",
    entidadId: id,
    payload: updates,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { motivo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const motivo = body.motivo?.trim() || "Comprobante manual anulado";

  const db = getDb();
  const [comp] = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)))
    .limit(1);
  if (!comp) {
    return NextResponse.json({ error: "comprobante_no_encontrado" }, { status: 404 });
  }
  if (comp.sunatEstado !== "manual") {
    return NextResponse.json(
      { error: "solo_se_pueden_anular_comprobantes_manuales" },
      { status: 409 },
    );
  }

  await db.delete(receipts).where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "comprobante.anular",
    entidad: "receipts",
    entidadId: id,
    payload: { serie: comp.serie, correlativo: comp.correlativo, motivo },
  });

  return NextResponse.json({ ok: true });
}
