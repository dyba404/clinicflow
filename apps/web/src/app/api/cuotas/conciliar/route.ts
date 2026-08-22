import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, installments, payments, quotes } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";
import { parseReferenciaCuotaQR } from "@/lib/pago-qr";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "caja");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { paymentId?: string; accion?: string; motivo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.paymentId || typeof body.paymentId !== "string") {
    return NextResponse.json({ error: "paymentId_requerido" }, { status: 400 });
  }
  const accion = body.accion === "confirmar" || body.accion === "rechazar" ? body.accion : null;
  if (!accion) {
    return NextResponse.json({ error: "accion_invalida" }, { status: 400 });
  }

  const db = getDb();
  const [pago] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, body.paymentId), eq(payments.tenantId, g.team.id)))
    .limit(1);
  if (!pago) {
    return NextResponse.json({ error: "pago_no_encontrado" }, { status: 404 });
  }
  if (pago.estado === "valido") {
    return NextResponse.json({ error: "pago_ya_conciliado" }, { status: 409 });
  }
  if (pago.estado === "anulado") {
    return NextResponse.json({ error: "ya_anulado" }, { status: 409 });
  }

  const refQr = parseReferenciaCuotaQR(pago.referencia);
  if (!refQr) {
    return NextResponse.json({ error: "no_es_pago_qr" }, { status: 400 });
  }

  const [cuota] = await db
    .select()
    .from(installments)
    .where(
      and(
        eq(installments.id, refQr.cuotaId),
        eq(installments.tenantId, g.team.id),
        eq(installments.patientId, pago.patientId ?? ""),
      ),
    )
    .limit(1);

  if (accion === "rechazar") {
    const motivo = body.motivo?.trim() || "Pago por QR sin transferencia verificable";
    await db
      .update(payments)
      .set({
        estado: "anulado",
        anuladoPor: g.user.id,
        anuladoAt: new Date(),
        motivoAnulacion: motivo,
      })
      .where(eq(payments.id, pago.id));

    void logAuditSesion({
      tenantId: g.team.id,
      accion: "pago.qr_rechazar",
      entidad: "payments",
      entidadId: pago.id,
      payload: { motivo, monto: pago.monto, cuotaId: refQr.cuotaId },
    });

    return NextResponse.json({ ok: true, estado: "anulado" });
  }

  if (!cuota) {
    return NextResponse.json({ error: "cuota_no_encontrada" }, { status: 404 });
  }
  if (cuota.estado === "pagada") {
    return NextResponse.json({ error: "cuota_ya_pagada" }, { status: 409 });
  }
  if (cuota.estado === "cancelada") {
    return NextResponse.json({ error: "cuota_cancelada" }, { status: 409 });
  }

  const nuevoPagado = Math.min(
    Number(cuota.monto),
    Math.round((Number(cuota.pagado) + Number(pago.monto)) * 100) / 100,
  );
  const estadoCuota = nuevoPagado >= Number(cuota.monto) - 0.005 ? "pagada" : "parcial";

  await db
    .update(payments)
    .set({ estado: "valido" })
    .where(eq(payments.id, pago.id));

  await db
    .update(installments)
    .set({
      estado: estadoCuota,
      pagado: nuevoPagado.toFixed(2),
      paymentId: pago.id,
    })
    .where(eq(installments.id, cuota.id));

  let presupuestoConvertido = false;
  if (cuota.quoteId) {
    const hermanas = await db
      .select({ id: installments.id, estado: installments.estado })
      .from(installments)
      .where(eq(installments.quoteId, cuota.quoteId));
    const todasPagadas = hermanas.length > 0 && hermanas.every((c) => c.estado === "pagada");
    if (todasPagadas) {
      await db
        .update(quotes)
        .set({ estado: "convertido", updatedAt: new Date() })
        .where(and(eq(quotes.id, cuota.quoteId), eq(quotes.estado, "aprobado")));
      presupuestoConvertido = true;
    }
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "pago.qr_conciliar",
    entidad: "payments",
    entidadId: pago.id,
    payload: {
      monto: pago.monto,
      cuotaId: cuota.id,
      estadoCuota,
      presupuestoConvertido,
    },
  });

  return NextResponse.json({
    ok: true,
    estado: "valido",
    cuota: { id: cuota.id, estado: estadoCuota, pagado: nuevoPagado.toFixed(2) },
    presupuestoConvertido,
  });
}
