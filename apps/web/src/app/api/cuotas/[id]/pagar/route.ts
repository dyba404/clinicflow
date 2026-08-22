import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, installments, payments, quotes } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "presupuestos");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { paymentId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.paymentId || typeof body.paymentId !== "string") {
    return NextResponse.json({ error: "paymentId_requerido" }, { status: 400 });
  }

  const db = getDb();
  const [cuota] = await db
    .select()
    .from(installments)
    .where(and(eq(installments.id, id), eq(installments.tenantId, g.team.id)))
    .limit(1);
  if (!cuota) {
    return NextResponse.json({ error: "cuota_no_encontrada" }, { status: 404 });
  }

  const [pago] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, body.paymentId), eq(payments.tenantId, g.team.id)))
    .limit(1);
  if (!pago) {
    return NextResponse.json({ error: "pago_no_encontrado" }, { status: 404 });
  }
  if (pago.patientId !== cuota.patientId) {
    return NextResponse.json({ error: "pago_paciente_no_coincide" }, { status: 400 });
  }
  if (cuota.estado === "pagada") {
    return NextResponse.json({ error: "cuota_ya_pagada" }, { status: 400 });
  }
  if (cuota.estado === "cancelada") {
    return NextResponse.json({ error: "cuota_cancelada" }, { status: 400 });
  }

  const [row] = await db
    .update(installments)
    .set({ estado: "pagada", pagado: cuota.monto, paymentId: pago.id })
    .where(and(eq(installments.id, id), eq(installments.tenantId, g.team.id)))
    .returning({ id: installments.id, estado: installments.estado, pagado: installments.pagado });

  let presupuestoConvertido = false;
  if (cuota.quoteId) {
    const hermanas = await db
      .select({ id: installments.id, estado: installments.estado })
      .from(installments)
      .where(and(eq(installments.quoteId, cuota.quoteId), eq(installments.tenantId, g.team.id)));
    const todasPagadas = hermanas.length > 0 && hermanas.every((c) => c.estado === "pagada");
    if (todasPagadas) {
      await db
        .update(quotes)
        .set({ estado: "convertido", updatedAt: new Date() })
        .where(
          and(
            eq(quotes.id, cuota.quoteId),
            eq(quotes.tenantId, g.team.id),
            eq(quotes.estado, "aprobado"),
          ),
        );
      presupuestoConvertido = true;
    }
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cuota.pagar",
    entidad: "installments",
    entidadId: id,
    payload: { paymentId: pago.id, pagado: cuota.monto, presupuestoConvertido },
  });

  return NextResponse.json({ ok: true, cuota: row, presupuestoConvertido });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "presupuestos");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { estado?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (body.estado !== "cancelada") {
    return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [cuota] = await db
    .select({ id: installments.id, estado: installments.estado })
    .from(installments)
    .where(and(eq(installments.id, id), eq(installments.tenantId, g.team.id)))
    .limit(1);
  if (!cuota) {
    return NextResponse.json({ error: "cuota_no_encontrada" }, { status: 404 });
  }
  if (cuota.estado === "pagada" || cuota.estado === "cancelada") {
    return NextResponse.json({ error: "transicion_invalida" }, { status: 400 });
  }

  const [row] = await db
    .update(installments)
    .set({ estado: "cancelada" })
    .where(and(eq(installments.id, id), eq(installments.tenantId, g.team.id)))
    .returning({ id: installments.id, estado: installments.estado });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cuota.cancelar",
    entidad: "installments",
    entidadId: id,
    payload: { de: cuota.estado, a: "cancelada" },
  });

  return NextResponse.json({ ok: true, cuota: row });
}
