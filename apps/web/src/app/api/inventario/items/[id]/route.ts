import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, inventoryItems, inventoryLots } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("inventory.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "inventario");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: Partial<{
    nombre: string;
    categoria: string;
    unidad: string;
    stockMin: number | string;
    costoUnit: number | string;
  }>;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [existente] = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, g.team.id)))
    .limit(1);
  if (!existente) return NextResponse.json({ error: "no_encontrado" }, { status: 404 });

  const set: Record<string, unknown> = {};
  if (body.nombre?.trim()) set.nombre = body.nombre.trim();
  if (body.categoria?.trim()) set.categoria = body.categoria.trim();
  if (body.unidad?.trim()) set.unidad = body.unidad.trim();
  if (body.stockMin !== undefined) {
    const n = Number(body.stockMin);
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "valor_invalido" }, { status: 400 });
    set.stockMin = n.toFixed(2);
  }
  if (body.costoUnit !== undefined) {
    const n = Number(body.costoUnit);
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "valor_invalido" }, { status: 400 });
    set.costoUnit = n.toFixed(2);
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "sin_cambios" }, { status: 400 });
  }

  await db.update(inventoryItems).set(set).where(eq(inventoryItems.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "inventario.item_editar",
    entidad: "inventory_items",
    entidadId: id,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("inventory.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "inventario");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const db = getDb();
  const rows = await db
    .update(inventoryItems)
    .set({ activo: false })
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, g.team.id)))
    .returning({ id: inventoryItems.id });
  if (rows.length === 0) return NextResponse.json({ error: "no_encontrado" }, { status: 404 });

  await db.delete(inventoryLots).where(eq(inventoryLots.itemId, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "inventario.item_inactivar",
    entidad: "inventory_items",
    entidadId: id,
  });

  return NextResponse.json({ ok: true });
}
