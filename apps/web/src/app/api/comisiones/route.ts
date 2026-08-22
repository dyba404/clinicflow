import { NextResponse } from "next/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, commissionEntries, memberships, users } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";
import { calcularComisionPorPago } from "@/lib/comisiones";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardStaff("commissions.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "comisiones");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const url = new URL(req.url);
  const periodoParam = url.searchParams.get("periodo") ?? "";
  const periodo = /^\d{4}-\d{2}$/.test(periodoParam)
    ? periodoParam
    : new Intl.DateTimeFormat("en-CA", { timeZone: g.team.timezone }).format(new Date()).slice(0, 7);

  const rows = await getDb()
    .select({
      doctorMembershipId: commissionEntries.doctorMembershipId,
      nombre: users.name,
      total: sql<string>`sum(${commissionEntries.monto})`,
      pagos: sql<number>`count(${commissionEntries.id})`.mapWith(Number),
    })
    .from(commissionEntries)
    .leftJoin(memberships, eq(memberships.id, commissionEntries.doctorMembershipId))
    .leftJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(commissionEntries.tenantId, g.team.id), eq(commissionEntries.periodo, periodo)))
    .groupBy(commissionEntries.doctorMembershipId, users.name)
    .orderBy(desc(sql`sum(${commissionEntries.monto})`), asc(users.name));

  return NextResponse.json({
    periodo,
    resumen: rows.map((r) => ({
      doctorMembershipId: r.doctorMembershipId,
      nombre: r.nombre ?? "—",
      total: Number(r.total ?? 0),
      pagos: r.pagos,
    })),
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "comisiones");
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

  const resultado = await calcularComisionPorPago(body.paymentId, g.team.timezone);

  if (!resultado.calculada) {
    return NextResponse.json({ ok: true, omitido: resultado.omitido });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "comision.calcular",
    entidad: "commission_entries",
    payload: { paymentId: body.paymentId, monto: resultado.monto, periodo: resultado.periodo },
  });

  return NextResponse.json(
    { ok: true, calculada: true, monto: resultado.monto, periodo: resultado.periodo },
    { status: 201 },
  );
}
