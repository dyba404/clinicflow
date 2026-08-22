import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, inventoryItems, inventoryLots, stockMovements } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export async function GET(req: Request) {
  const g = await guardStaff("inventory.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "inventario");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");

  const db = getDb();
  const query = db
    .select({
      id: stockMovements.id,
      itemId: stockMovements.itemId,
      tipo: stockMovements.tipo,
      cantidad: stockMovements.cantidad,
      nota: stockMovements.nota,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements);
  const rows = itemId
    ? await query.where(and(eq(stockMovements.tenantId, g.team.id), eq(stockMovements.itemId, itemId)))
    : await query.where(eq(stockMovements.tenantId, g.team.id));

  return NextResponse.json({
    movimientos: rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 200),
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("inventory.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "inventario");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: {
    itemId?: string;
    tipo?: "ingreso" | "merma" | "ajuste";
    cantidad?: number | string;
    lote?: string;
    vence?: string;
    nota?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!body.itemId || !["ingreso", "merma", "ajuste"].includes(body.tipo ?? "")) {
    return NextResponse.json({ error: "parametros_invalidos" }, { status: 400 });
  }
  const tipo = body.tipo as "ingreso" | "merma" | "ajuste";
  const cantidad = Number(body.cantidad);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return NextResponse.json({ error: "cantidad_invalida" }, { status: 400 });
  }

  const db = getDb();
  const [item] = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, body.itemId), eq(inventoryItems.tenantId, g.team.id), eq(inventoryItems.activo, true)))
    .limit(1);
  if (!item) return NextResponse.json({ error: "item_no_encontrado" }, { status: 404 });

  const stockActual = Number(item.stock);
  const delta = tipo === "ingreso" ? cantidad : tipo === "merma" ? -cantidad : null;

  if (delta === null) {
    if (cantidad > 999999) {
      return NextResponse.json({ error: "cantidad_invalida" }, { status: 400 });
    }
    await db
      .update(inventoryItems)
      .set({ stock: cantidad.toFixed(2) })
      .where(eq(inventoryItems.id, item.id));
  } else {
    const nuevo = stockActual + delta;
    if (nuevo < 0) {
      return NextResponse.json({ error: "stock_insuficiente" }, { status: 400 });
    }
    await db
      .update(inventoryItems)
      .set({ stock: nuevo.toFixed(2) })
      .where(eq(inventoryItems.id, item.id));
  }

  if (tipo === "ingreso" && body.lote?.trim()) {
    await db.insert(inventoryLots).values({
      itemId: item.id,
      lote: body.lote.trim(),
      vence: body.vence && /^\d{4}-\d{2}-\d{2}$/.test(body.vence) ? body.vence : null,
      cantidad: cantidad.toFixed(2),
    });
  }

  const cantidadMov =
    tipo === "ingreso"
      ? cantidad.toFixed(2)
      : tipo === "merma"
        ? (-cantidad).toFixed(2)
        : cantidad.toFixed(2);
  const [mov] = await db
    .insert(stockMovements)
    .values({
      tenantId: g.team.id,
      itemId: item.id,
      tipo,
      cantidad: cantidadMov,
      nota: body.nota?.trim() || null,
      createdBy: g.user.id,
    })
    .returning({ id: stockMovements.id });
  if (!mov) return NextResponse.json({ error: "error_al_guardar" }, { status: 500 });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: `inventario.${tipo}`,
    entidad: "stock_movements",
    entidadId: mov.id,
    payload: { itemId: item.id, cantidad, tipo },
  });

  const [actualizado] = await db
    .select({ stock: inventoryItems.stock })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, item.id));

  return NextResponse.json({ ok: true, stock: actualizado?.stock }, { status: 201 });
}
