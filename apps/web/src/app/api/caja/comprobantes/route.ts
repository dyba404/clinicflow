import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb, payments, receipts } from "@clinicflow/db";
import type { ReceiptType } from "@clinicflow/core";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { comprobantesConPago } from "@/lib/console-data";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TIPOS: readonly ReceiptType[] = ["boleta", "factura"];

export async function GET() {
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const rows = await comprobantesConPago(g.team.id);
  return NextResponse.json({ comprobantes: rows });
}

export async function POST(req: Request) {
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: {
    paymentId?: string;
    tipo?: string;
    serie?: string;
    correlativo?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tipo = body.tipo;
  if (typeof tipo !== "string" || !(TIPOS as readonly string[]).includes(tipo)) {
    if (tipo === "nota_credito" || tipo === "nota_debito") {
      return NextResponse.json(
        { error: "nota_no_manual", message: "Las notas de crédito se generan al dar de baja un comprobante aceptado (botón Baja)." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "tipo_desconocido" }, { status: 400 });
  }
  const serie = body.serie?.trim();
  if (typeof body.serie !== "string" || !serie || serie.length < 1 || serie.length > 12) {
    return NextResponse.json({ error: "serie_invalida" }, { status: 400 });
  }
  const correlativo = Number(body.correlativo);
  if (!Number.isInteger(correlativo) || correlativo < 1) {
    return NextResponse.json({ error: "correlativo_invalido" }, { status: 400 });
  }

  const db = getDb();

  if (typeof body.paymentId !== "string" || body.paymentId.length === 0) {
    return NextResponse.json({ error: "pago_invalido" }, { status: 400 });
  }
  const [pago] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.id, body.paymentId), eq(payments.tenantId, g.team.id)))
    .limit(1);
  if (!pago) {
    return NextResponse.json({ error: "pago_no_encontrado" }, { status: 404 });
  }

  const [existente] = await db
    .select({ id: receipts.id })
    .from(receipts)
    .where(
      and(
        eq(receipts.paymentId, pago.id),
        eq(receipts.tenantId, g.team.id),
        sql`${receipts.tipo} in ('boleta', 'factura')`,
      ),
    )
    .limit(1);
  if (existente) {
    return NextResponse.json({ error: "pago_ya_con_comprobante" }, { status: 400 });
  }

  const rows = await db
    .insert(receipts)
    .values({
      tenantId: g.team.id,
      paymentId: pago.id,
      tipo: tipo as ReceiptType,
      serie,
      correlativo,
      estado: "manual",
      registradoPor: g.user.id,
    })
    .onConflictDoNothing({
      target: [receipts.tenantId, receipts.tipo, receipts.serie, receipts.correlativo],
    })
    .returning({ id: receipts.id });

  if (rows.length === 0) {
    return NextResponse.json({ error: "correlativo_ocupado" }, { status: 409 });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "comprobante.emitir",
    entidad: "receipts",
    entidadId: rows[0]!.id,
    payload: { tipo, serie, correlativo },
  });

  return NextResponse.json({ ok: true, id: rows[0]!.id }, { status: 201 });
}
