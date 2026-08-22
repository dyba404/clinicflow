import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb, convenios, insurers } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardStaff("billing.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const rows = await getDb()
    .select({
      id: convenios.id,
      insurerId: convenios.insurerId,
      nombreAseguradora: insurers.nombre,
      tipo: convenios.tipo,
      descuentoPct: convenios.descuentoPct,
      activo: convenios.activo,
      createdAt: convenios.createdAt,
    })
    .from(convenios)
    .innerJoin(insurers, eq(convenios.insurerId, insurers.id))
    .where(eq(convenios.tenantId, g.team.id))
    .orderBy(asc(insurers.nombre));

  return NextResponse.json({
    convenios: rows.map((r) => ({ ...r, descuentoNum: Number(r.descuentoPct) })),
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("billing.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { insurerId?: string; tipo?: string; descuentoPct?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tipo = body.tipo?.trim() ?? "";
  if (tipo.length < 2) {
    return NextResponse.json({ error: "tipo_in" }, { status: 400 });
  }

  const descuento = Number(body.descuentoPct ?? 0);
  if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
    return NextResponse.json({ error: "descuento_invalido" }, { status: 400 });
  }

  if (!body.insurerId) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [aseguradora] = await db
    .select({ id: insurers.id })
    .from(insurers)
    .where(and(eq(insurers.id, body.insurerId), eq(insurers.tenantId, g.team.id)))
    .limit(1);
  if (!aseguradora) {
    return NextResponse.json({ error: "aseguradora_no_encontrada" }, { status: 404 });
  }

  const [duplicado] = await db
    .select({ id: convenios.id })
    .from(convenios)
    .where(
      and(
        eq(convenios.tenantId, g.team.id),
        eq(convenios.insurerId, aseguradora.id),
        eq(convenios.activo, true),
      ),
    )
    .limit(1);
  if (duplicado) {
    return NextResponse.json({ error: "convenio_duplicado" }, { status: 409 });
  }

  const [row] = await db
    .insert(convenios)
    .values({
      tenantId: g.team.id,
      insurerId: aseguradora.id,
      tipo,
      descuentoPct: descuento.toFixed(2),
    })
    .returning({
      id: convenios.id,
      insurerId: convenios.insurerId,
      tipo: convenios.tipo,
      descuentoPct: convenios.descuentoPct,
      activo: convenios.activo,
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "convenio.crear",
    entidad: "convenios",
    entidadId: row!.id,
    payload: { insurerId: aseguradora.id, tipo, descuentoPct: descuento },
  });

  return NextResponse.json({ ok: true, id: row!.id, convenio: row }, { status: 201 });
}
