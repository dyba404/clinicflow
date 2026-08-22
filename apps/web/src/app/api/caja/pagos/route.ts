import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, payments, patients, appointments, receipts, vatSettings } from "@clinicflow/db";
import type { PaymentMethod } from "@clinicflow/core";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";
import { calcularComisionPorPago } from "@/lib/comisiones";
import { sucursalActiva } from "@/lib/branch";
import { ultimoCorrelativo } from "@/lib/console-data";
import { emitirComprobante } from "@/lib/emitir";

const METODOS: PaymentMethod[] = [
  "yape",
  "plin",
  "efectivo",
  "tarjeta_pos",
  "tarjeta_online",
  "otro",
];

export async function POST(req: Request) {
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "caja");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: {
    monto?: number;
    metodo?: string;
    patientId?: string | null;
    appointmentId?: string | null;
    referencia?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: "monto_invalido" }, { status: 400 });
  }
  const metodo = body.metodo as PaymentMethod;
  if (!METODOS.includes(metodo)) {
    return NextResponse.json({ error: "metodo_desconocido" }, { status: 400 });
  }

  const db = getDb();

  let patientId: string | null = null;
  let patientDoc: string | null = null;
  if (body.patientId) {
    const [p] = await db
      .select({ id: patients.id, documento: patients.documento })
      .from(patients)
      .where(and(eq(patients.id, body.patientId), eq(patients.tenantId, g.team.id)))
      .limit(1);
    if (p) {
      patientId = p.id;
      patientDoc = p.documento;
    }
  }

  let appointmentId: string | null = null;
  if (body.appointmentId) {
    const [a] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.id, body.appointmentId), eq(appointments.tenantId, g.team.id)))
      .limit(1);
    appointmentId = a ? a.id : null;
  }

  const branchId = await sucursalActiva(g.team.id);

  const [row] = await db
    .insert(payments)
    .values({
      tenantId: g.team.id,
      branchId,
      patientId,
      appointmentId,
      monto: monto.toFixed(2),
      metodo,
      referencia: body.referencia?.trim() || null,
      registradoPor: g.user.id,
    })
    .returning({ id: payments.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "pago.registrar",
    entidad: "payments",
    entidadId: row!.id,
    payload: { monto, metodo },
  });

  void calcularComisionPorPago(row!.id, g.team.timezone).catch(() => {});

  let comprobante: { numero: string; estado: string } | null = null;
  const doc = patientDoc?.replace(/\s+/g, "") ?? null;

  try {
    const [vat] = await db
      .select({
        emision: vatSettings.emision,
        emisionAuto: vatSettings.emisionAuto,
        serieBoleta: vatSettings.serieBoleta,
        serieFactura: vatSettings.serieFactura,
        corrBoleta: vatSettings.corrBoleta,
        corrFactura: vatSettings.corrFactura,
      })
      .from(vatSettings)
      .where(eq(vatSettings.tenantId, g.team.id))
      .limit(1);

    if (vat && vat.emision === "electronica" && vat.emisionAuto) {
      const tipo = doc && /^\d{11}$/.test(doc) ? "factura" : "boleta";
      const serie = tipo === "factura" ? vat.serieFactura : vat.serieBoleta;

      const ultimo = await ultimoCorrelativo(g.team.id, tipo, serie);
      const correlativo = ultimo ? ultimo + 1 : 1;

      const [receipt] = await db
        .insert(receipts)
        .values({
          tenantId: g.team.id,
          paymentId: row!.id,
          tipo,
          serie,
          correlativo,
          estado: "electronica",
          sunatEstado: "pendiente_envio",
          emitidaPor: g.user.id,
          registradoPor: g.user.id,
        })
        .returning({ id: receipts.id });

      if (receipt) {
        const numero = `${serie}-${String(correlativo).padStart(8, "0")}`;
        try {
          const emision = await emitirComprobante({
            tenantId: g.team.id,
            receiptId: receipt.id,
            usuarioId: g.user.id,
          });
          if (emision.ok) {
            comprobante = { numero, estado: "aceptado" };
          } else if (emision.error === "rechazado_sunat") {
            comprobante = { numero, estado: "rechazado" };
          } else {
            comprobante = { numero, estado: "pendiente_envio" };
          }
        } catch {
          comprobante = { numero, estado: "pendiente_envio" };
        }
      }
    }
  } catch {
    // La emision automatica no bloquea el registro del pago
  }

  return NextResponse.json({ ok: true, id: row!.id, comprobante }, { status: 201 });
}
