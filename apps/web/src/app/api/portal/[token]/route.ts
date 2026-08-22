import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  getDb,
  appointments,
  services,
  memberships,
  users,
  installments,
  payments,
  receipts,
  quotes,
  signedConsents,
  orders,
  orderResults,
} from "@clinicflow/db";
import { resolvePortalToken } from "@/lib/magic-link";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ESTADOS_PROXIMOS = ["solicitada", "confirmada", "en_espera", "en_atencion"] as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const limite = rateLimit(`portal:${token}:${ipReq(req)}`, 20);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const r = await resolvePortalToken(token);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 404 });
  const { ctx } = r;
  const db = getDb();

  const citas = await db
    .select({
      id: appointments.id,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      horaFin: appointments.horaFin,
      estado: appointments.estado,
      servicio: services.nombre,
      serviceId: appointments.serviceId,
      doctorId: appointments.doctorId,
      doctorNombre: users.name,
    })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(memberships, eq(appointments.doctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(appointments.patientId, ctx.patient.id),
        eq(appointments.tenantId, ctx.team.id),
      ),
    )
    .orderBy(appointments.fecha, appointments.horaIni);

  const proximas = citas
    .filter((c) => (ESTADOS_PROXIMOS as readonly string[]).includes(c.estado))
    .map((c) => ({
      id: c.id,
      fecha: c.fecha,
      horaIni: c.horaIni,
      horaFin: c.horaFin,
      estado: c.estado,
      servicio: c.servicio,
      doctor: c.doctorNombre,
      puedeConfirmar: c.estado === "solicitada",
    }));

  const historial = citas
    .filter((c) => !(ESTADOS_PROXIMOS as readonly string[]).includes(c.estado))
    .map((c) => ({
      id: c.id,
      fecha: c.fecha,
      horaIni: c.horaIni,
      estado: c.estado,
      servicio: c.servicio,
      doctor: c.doctorNombre,
    }))
    .sort((a, b) => (a.fecha === b.fecha ? (a.horaIni < b.horaIni ? 1 : -1) : a.fecha < b.fecha ? 1 : -1))
    .slice(0, 20);

  const cuotas = await db
    .select({
      id: installments.id,
      concepto: installments.concepto,
      n: installments.n,
      monto: installments.monto,
      pagado: installments.pagado,
      vence: installments.vence,
      estado: installments.estado,
    })
    .from(installments)
    .where(
      and(eq(installments.patientId, ctx.patient.id), eq(installments.tenantId, ctx.team.id)),
    )
    .orderBy(installments.vence, installments.n);

  const cuotasPendientes = cuotas
    .filter((c) => c.estado === "pendiente" || c.estado === "parcial" || c.estado === "vencida")
    .map((c) => ({
      id: c.id,
      concepto: c.concepto,
      n: c.n,
      monto: c.monto,
      saldo: (Math.round((Number(c.monto) - Number(c.pagado)) * 100) / 100).toFixed(2),
      vence: c.vence,
      estado: c.estado,
    }));

  const comprobantes = await db
    .select({
      id: receipts.id,
      tipo: receipts.tipo,
      serie: receipts.serie,
      correlativo: receipts.correlativo,
      sunatEstado: receipts.sunatEstado,
      emitidaAt: receipts.emitidaAt,
      patientId: payments.patientId,
    })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .where(
      and(
        eq(receipts.tenantId, ctx.team.id),
        eq(payments.patientId, ctx.patient.id),
        eq(receipts.sunatEstado, "aceptado"),
        inArray(receipts.tipo, ["boleta", "factura"]),
      ),
    );

  const presupuestos = await db
    .select({
      id: quotes.id,
      titulo: quotes.titulo,
      total: quotes.total,
      estado: quotes.estado,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .where(
      and(
        eq(quotes.patientId, ctx.patient.id),
        inArray(quotes.estado, ["enviado", "aprobado"]),
      ),
    )
    .orderBy(desc(quotes.createdAt));

  const consentimientos = await db
    .select({
      id: signedConsents.id,
      servicioNombre: signedConsents.servicioNombre,
      signedBy: signedConsents.signedBy,
      signedAt: signedConsents.signedAt,
    })
    .from(signedConsents)
    .where(eq(signedConsents.patientId, ctx.patient.id))
    .orderBy(signedConsents.signedAt);

  const ordenesLiberadas = await db
    .select({
      id: orders.id,
      nombre: orders.nombre,
      tipo: orders.tipo,
      estado: orders.estado,
      resultadoAt: orders.resultadoAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.patientId, ctx.patient.id),
        eq(orders.tenantId, ctx.team.id),
        inArray(orders.estado, ["liberada", "entregada"]),
        inArray(orders.tipo, ["laboratorio", "imagen"]),
      ),
    )
    .orderBy(desc(orders.resultadoAt));

  const resultados = ordenesLiberadas.length
    ? await db
        .select({
          orderId: orderResults.orderId,
          parametro: orderResults.parametro,
          valorText: orderResults.valorText,
          valorNum: orderResults.valorNum,
          unidad: orderResults.unidad,
          referencia: orderResults.referencia,
          flag: orderResults.flag,
        })
        .from(orderResults)
        .where(
          inArray(
            orderResults.orderId,
            ordenesLiberadas.map((o) => o.id),
          ),
        )
        .orderBy(asc(orderResults.createdAt))
    : [];

  const resultadosPorOrden = new Map<string, typeof resultados>();
  for (const fila of resultados) {
    const arr = resultadosPorOrden.get(fila.orderId) ?? [];
    arr.push(fila);
    resultadosPorOrden.set(fila.orderId, arr);
  }

  void logAudit({
    tenantId: ctx.team.id,
    accion: "portal.acceder",
    entidad: "patients",
    entidadId: ctx.patient.id,
    payload: { via: "token_portal" },
  });

  return NextResponse.json({
    clinica: { nombre: ctx.team.name, slug: ctx.team.slug },
    paciente: { nombre: ctx.patient.nombre },
    proximasCitas: proximas,
    historial,
    cuotasPendientes,
    comprobantes: comprobantes.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      numero: `${c.serie}-${String(c.correlativo).padStart(8, "0")}`,
      emitidaAt: c.emitidaAt,
    })),
    presupuestos: presupuestos.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      total: p.total,
      estado: p.estado,
    })),
    consentimientos: consentimientos.map((c) => ({
      servicioNombre: c.servicioNombre,
      signedBy: c.signedBy,
      signedAt: c.signedAt,
    })),
    resultados: ordenesLiberadas
      .filter((o) => (resultadosPorOrden.get(o.id)?.length ?? 0) > 0)
      .map((o) => ({
        id: o.id,
        nombre: o.nombre,
        tipo: o.tipo,
        estado: o.estado,
        resultadoAt: o.resultadoAt,
        parametros: (resultadosPorOrden.get(o.id) ?? []).map((f) => ({
          parametro: f.parametro,
          valorText: f.valorText,
          valorNum: f.valorNum,
          unidad: f.unidad,
          referencia: f.referencia,
          flag: f.flag,
        })),
      })),
  });
}
