import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, payments, insurers } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { insurerId?: string; monto?: number | string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (typeof body.insurerId !== "string" || !body.insurerId) {
    return NextResponse.json({ error: "insurer_invalido" }, { status: 400 });
  }

  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto < 0) {
    return NextResponse.json({ error: "monto_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [pago] = await db
    .select({
      id: payments.id,
      monto: payments.monto,
      referencia: payments.referencia,
      estado: payments.estado,
    })
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.tenantId, g.team.id)))
    .limit(1);
  if (!pago) {
    return NextResponse.json({ error: "pago_no_encontrado" }, { status: 404 });
  }
  if (pago.estado === "anulado") {
    return NextResponse.json({ error: "pago_anulado" }, { status: 409 });
  }

  if (monto > Number(pago.monto)) {
    return NextResponse.json({ error: "monto_excede_pago" }, { status: 400 });
  }

  const [aseguradora] = await db
    .select({ id: insurers.id, nombre: insurers.nombre })
    .from(insurers)
    .where(and(eq(insurers.id, body.insurerId), eq(insurers.tenantId, g.team.id)))
    .limit(1);
  if (!aseguradora) {
    return NextResponse.json({ error: "aseguradora_no_encontrada" }, { status: 404 });
  }

  const montoTexto = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(monto);
  const base = (pago.referencia ?? "").trim();
  const nueva = `${base} · Aseguradora: ${aseguradora.nombre} (${montoTexto})`.trim();

  const [row] = await db
    .update(payments)
    .set({ referencia: nueva })
    .where(and(eq(payments.id, id), eq(payments.tenantId, g.team.id)))
    .returning({ id: payments.id, referencia: payments.referencia });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "pago.aseguradora",
    entidad: "payments",
    entidadId: id,
    payload: { insurerId: aseguradora.id, monto },
  });

  return NextResponse.json({ ok: true, id: row!.id, referencia: row!.referencia });
}
