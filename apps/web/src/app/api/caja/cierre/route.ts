import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, cashClosures, payments } from "@clinicflow/db";
import { guardStaff, guardError, hoyTenant } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export async function POST(req: Request) {
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "caja");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { cierreReal?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const cierreReal = Number(body.cierreReal);
  if (!Number.isFinite(cierreReal) || cierreReal < 0) {
    return NextResponse.json({ error: "cierre_real_invalido" }, { status: 400 });
  }

  const db = getDb();
  const fecha = await hoyTenant(g.team.timezone);

  const [cierrePrevio] = await db
    .select({ id: cashClosures.id, estado: cashClosures.estado })
    .from(cashClosures)
    .where(and(eq(cashClosures.tenantId, g.team.id), eq(cashClosures.fecha, fecha)))
    .orderBy(desc(cashClosures.createdAt))
    .limit(1);
  if (cierrePrevio && cierrePrevio.estado === "cerrado") {
    return NextResponse.json({ error: "ya_cerrada" }, { status: 409 });
  }

  const pagos = await db
    .select({ monto: payments.monto, createdAt: payments.createdAt, estado: payments.estado })
    .from(payments)
    .where(eq(payments.tenantId, g.team.id));
  const cierreSistema = pagos.reduce((acc, p) => {
    if (p.estado === "anulado" || p.estado === "por_conciliar") return acc;
    const d = p.createdAt
      ? new Intl.DateTimeFormat("en-CA", { timeZone: g.team.timezone }).format(
          new Date(p.createdAt),
        )
      : null;
    return d === fecha ? acc + Number(p.monto) : acc;
  }, 0);

  const diferencia = Math.round((cierreReal - cierreSistema) * 100) / 100;

  const rows = await db
    .insert(cashClosures)
    .values({
      tenantId: g.team.id,
      fecha,
      cierreReal: cierreReal.toFixed(2),
      cierreSistema: cierreSistema.toFixed(2),
      diferencia: diferencia.toFixed(2),
      cerradoPor: g.user.id,
    })
    .returning();

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "caja.cierre",
    entidad: "caja",
    entidadId: rows[0]!.id,
    payload: { cierreSistema, cierreReal },
  });

  return NextResponse.json({ cierre: rows[0] }, { status: 201 });
}
