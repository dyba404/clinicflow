import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, inventoryItems } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export async function GET(req: Request) {
  const g = await guardStaff("inventory.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "inventario");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const url = new URL(req.url);
  const activos = url.searchParams.get("activos") !== "0";

  const where = activos
    ? and(eq(inventoryItems.tenantId, g.team.id), eq(inventoryItems.activo, true))
    : eq(inventoryItems.tenantId, g.team.id);

  const items = await getDb()
    .select()
    .from(inventoryItems)
    .where(where);

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const g = await guardStaff("inventory.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "inventario");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: {
    nombre?: string;
    categoria?: string;
    unidad?: string;
    stock?: number | string;
    stockMin?: number | string;
    costoUnit?: number | string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim();
  if (!nombre || nombre.length < 2 || nombre.length > 80) {
    return NextResponse.json({ error: "nombre_invalido" }, { status: 400 });
  }
  const num = (v: number | string | undefined, def: string) => {
    const n = Number(v ?? def);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const stock = num(body.stock, "0");
  const stockMin = num(body.stockMin, "1");
  const costoUnit = num(body.costoUnit, "0");
  if (stock === null || stockMin === null || costoUnit === null) {
    return NextResponse.json({ error: "valor_invalido" }, { status: 400 });
  }

  const [row] = await getDb()
    .insert(inventoryItems)
    .values({
      tenantId: g.team.id,
      nombre,
      categoria: body.categoria?.trim() || "general",
      unidad: body.unidad?.trim() || "und",
      stock: stock.toFixed(2),
      stockMin: stockMin.toFixed(2),
      costoUnit: costoUnit.toFixed(2),
    })
    .returning();
  if (!row) return NextResponse.json({ error: "error_al_guardar" }, { status: 500 });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "inventario.item_crear",
    entidad: "inventory_items",
    entidadId: row.id,
    payload: { nombre },
  });

  return NextResponse.json({ ok: true, item: row }, { status: 201 });
}
