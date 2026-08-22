import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb, payments, commissionEntries, installments, receipts } from "@clinicflow/db";
import { guardStaff, guardError, getSession } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "caja");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);
  const session = await getSession();

  let body: { motivo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const motivo = body.motivo?.trim();
  if (!motivo || motivo.length < 3) {
    return NextResponse.json({ error: "motivo_requerido" }, { status: 400 });
  }

  const db = getDb();
  const [pago] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.tenantId, g.team.id)))
    .limit(1);
  if (!pago) {
    return NextResponse.json({ error: "pago_no_encontrado" }, { status: 404 });
  }
  if (pago.estado === "anulado") {
    return NextResponse.json({ error: "ya_anulado" }, { status: 409 });
  }

  const [comprobante] = await db
    .select({ id: receipts.id, sunatEstado: receipts.sunatEstado })
    .from(receipts)
    .where(
      and(
        eq(receipts.paymentId, id),
        eq(receipts.tenantId, g.team.id),
        sql`${receipts.tipo} in ('boleta', 'factura')`,
      ),
    )
    .limit(1);
  if (comprobante && comprobante.sunatEstado === "aceptado") {
    return NextResponse.json(
      { error: "comprobante_sunat_aceptado_primero_dar_baja" },
      { status: 409 },
    );
  }

  await db
    .update(payments)
    .set({
      estado: "anulado",
      anuladoPor: g.user.id,
      anuladoAt: new Date(),
      motivoAnulacion: motivo,
    })
    .where(eq(payments.id, id));

  await db
    .update(installments)
    .set({ estado: "pendiente", pagado: "0", paymentId: null })
    .where(and(eq(installments.paymentId, id), eq(installments.tenantId, g.team.id)));

  const revertidas = await db
    .update(commissionEntries)
    .set({ monto: "0" })
    .where(
      and(
        eq(commissionEntries.paymentId, id),
        eq(commissionEntries.tenantId, g.team.id),
      ),
    )
    .returning({ id: commissionEntries.id, monto: commissionEntries.monto });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "pago.anular",
    entidad: "payments",
    entidadId: id,
    payload: {
      motivo,
      monto: pago.monto,
      comisionesRevertidas: revertidas.length,
      por: session?.userId ?? g.user.id,
    },
  });

  return NextResponse.json({
    ok: true,
    id,
    estado: "anulado",
    comisionesRevertidas: revertidas.length,
  });
}
