import { NextResponse } from "next/server";
import { and, eq, like } from "drizzle-orm";
import { getDb, installments, payments } from "@clinicflow/db";
import { resolvePortalAccess } from "@/lib/portal-access";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import {
  contenidoQrPago,
  generarRefQR,
  numeroYapePlin,
  parseReferenciaCuotaQR,
  qrPagoBase64,
  referenciaCuotaQR,
} from "@/lib/pago-qr";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const limite = rateLimit(`portal:pagar:${token}:${ipReq(req)}`, 6);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const r = await resolvePortalAccess(token);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 404 });
  const { ctx } = r;

  let body: { cuotaId?: string; metodo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.cuotaId || typeof body.cuotaId !== "string") {
    return NextResponse.json({ error: "cuotaId_requerido" }, { status: 400 });
  }
  const metodo = body.metodo === "plin" ? "plin" : "yape";

  const planCheck = await gatePlan(ctx.team.id, "presupuestos");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const db = getDb();
  const [cuota] = await db
    .select()
    .from(installments)
    .where(
      and(
        eq(installments.id, body.cuotaId),
        eq(installments.tenantId, ctx.team.id),
        eq(installments.patientId, ctx.patient.id),
      ),
    )
    .limit(1);

  if (!cuota) {
    return NextResponse.json({ error: "cuota_no_encontrada" }, { status: 404 });
  }
  if (cuota.estado === "pagada" || cuota.estado === "cancelada") {
    return NextResponse.json({ error: "cuota_no_pagable" }, { status: 409 });
  }

  const saldo = Math.round((Number(cuota.monto) - Number(cuota.pagado)) * 100) / 100;
  if (saldo <= 0) {
    return NextResponse.json({ error: "cuota_ya_pagada" }, { status: 409 });
  }

  const pendientes = await db
    .select({ id: payments.id, referencia: payments.referencia, monto: payments.monto })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, ctx.team.id),
        eq(payments.patientId, ctx.patient.id),
        eq(payments.estado, "por_conciliar"),
        like(payments.referencia, "QR:%"),
      ),
    )
    .limit(20);

  const existente =
    pendientes.find((p) => parseReferenciaCuotaQR(p.referencia)?.cuotaId === cuota.id) ?? null;
  const refEx = existente ? parseReferenciaCuotaQR(existente.referencia) : null;
  const ref = refEx?.ref ?? generarRefQR();
  const referencia = referenciaCuotaQR(ref, cuota.id);
  let reutilizado = false;

  if (existente && refEx) {
    reutilizado = true;
    await db
      .update(payments)
      .set({ monto: saldo.toFixed(2), metodo, referencia })
      .where(and(eq(payments.id, existente.id), eq(payments.estado, "por_conciliar")));
  } else {
    await db.insert(payments).values({
      tenantId: ctx.team.id,
      patientId: ctx.patient.id,
      monto: saldo.toFixed(2),
      metodo,
      referencia,
      registradoPor: null,
      estado: "por_conciliar",
    });
  }

  void logAudit({
    tenantId: ctx.team.id,
    accion: reutilizado ? "pago.qr_regenerado" : "pago.qr_generado",
    entidad: "cuotas",
    entidadId: cuota.id,
    payload: { monto: saldo, metodo, ref, via: "portal_paciente" },
  });

  const qr = await qrPagoBase64(
    contenidoQrPago({
      clinica: ctx.team.name,
      monto: saldo,
      ref,
      numero: numeroYapePlin(),
    }),
  );

  return NextResponse.json(
    {
      ok: true,
      qr,
      ref,
      monto: saldo.toFixed(2),
      metodo,
      numeroYape: numeroYapePlin(),
      concepto: cuota.concepto,
      clinica: ctx.team.name,
    },
    { status: 201 },
  );
}
