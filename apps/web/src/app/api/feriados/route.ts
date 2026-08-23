import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb, holidays } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardStaff("services.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const rows = await getDb()
    .select({
      id: holidays.id,
      fecha: holidays.fecha,
      nombre: holidays.nombre,
    })
    .from(holidays)
    .where(eq(holidays.tenantId, g.team.id))
    .orderBy(asc(holidays.fecha));

  return NextResponse.json({ feriados: rows });
}

export async function POST(req: Request) {
  const g = await guardStaff("services.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { fecha?: string; nombre?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const fecha = body.fecha ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
  }
  const nombre = body.nombre?.trim() || "";
  if (!nombre) {
    return NextResponse.json({ error: "nombre_requerido" }, { status: 400 });
  }

  let row;
  try {
    [row] = await getDb()
      .insert(holidays)
      .values({ tenantId: g.team.id, fecha, nombre })
      .returning({ id: holidays.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const constraint = (e as { constraint_name?: string } | null)?.constraint_name ?? "";
    if (/holidays_tenant_fecha_key/i.test(`${msg} ${constraint}`)) {
      return NextResponse.json({ error: "feriado_duplicado" }, { status: 409 });
    }
    throw e;
  }
  if (!row) {
    return NextResponse.json({ error: "no_se_pudo_crear" }, { status: 500 });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "feriado.crear",
    entidad: "holidays",
    entidadId: row.id,
    payload: { fecha, nombre },
  });

  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}

export async function DELETE(req: Request) {
  const g = await guardStaff("services.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id_requerido" }, { status: 400 });
  }

  const rows = await getDb()
    .delete(holidays)
    .where(and(eq(holidays.id, id), eq(holidays.tenantId, g.team.id)))
    .returning({ id: holidays.id, fecha: holidays.fecha });
  if (rows.length === 0) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "feriado.eliminar",
    entidad: "holidays",
    entidadId: id,
    payload: { fecha: rows[0]!.fecha },
  });

  return NextResponse.json({ ok: true });
}
