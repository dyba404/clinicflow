import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb, quotes, installments } from "@clinicflow/db";
import { guardStaff, guardError, hoyTenant } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

function masDias(fechaBase: string, dias: number): string {
  const d = new Date(`${fechaBase}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "presupuestos");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const db = getDb();
  const [presupuesto] = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.tenantId, g.team.id)))
    .limit(1);
  if (!presupuesto) {
    return NextResponse.json({ error: "presupuesto_no_encontrado" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: installments.id,
      n: installments.n,
      concepto: installments.concepto,
      monto: installments.monto,
      pagado: installments.pagado,
      vence: installments.vence,
      estado: installments.estado,
      createdAt: installments.createdAt,
    })
    .from(installments)
    .where(and(eq(installments.tenantId, g.team.id), eq(installments.quoteId, id)))
    .orderBy(asc(installments.n), asc(installments.createdAt));

  return NextResponse.json({ cuotas: rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "presupuestos");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { n?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const n = Number(body.n);
  if (!Number.isInteger(n) || n < 1 || n > 24) {
    return NextResponse.json({ error: "n_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [presupuesto] = await db
    .select({ id: quotes.id, patientId: quotes.patientId, titulo: quotes.titulo, total: quotes.total, estado: quotes.estado })
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.tenantId, g.team.id)))
    .limit(1);
  if (!presupuesto) {
    return NextResponse.json({ error: "presupuesto_no_encontrado" }, { status: 404 });
  }
  if (presupuesto.estado !== "aprobado") {
    return NextResponse.json({ error: "presupuesto_no_aprobado" }, { status: 400 });
  }

  const totalCent = Math.round(Number(presupuesto.total) * 100);
  const cuotaCent = Math.floor(totalCent / n);
  const hoy = await hoyTenant(g.team.timezone);

  const valores = Array.from({ length: n }, (_, i) => {
    const esUltima = i === n - 1;
    const montoCent = esUltima ? totalCent - cuotaCent * (n - 1) : cuotaCent;
    return {
      tenantId: g.team.id,
      patientId: presupuesto.patientId,
      quoteId: presupuesto.id,
      concepto: presupuesto.titulo,
      n: i + 1,
      monto: (montoCent / 100).toFixed(2),
      vence: masDias(hoy, 30 * (i + 1)),
      estado: "pendiente" as const,
    };
  });

  await db.insert(installments).values(valores);

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cuotas.generar",
    entidad: "quotes",
    entidadId: presupuesto.id,
    payload: { n, total: presupuesto.total },
  });

  return NextResponse.json({ ok: true, generadas: n }, { status: 201 });
}
