import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb, inventoryItems, inventoryLots } from "@clinicflow/db";
import { guardStaff, guardError, hoyTenant } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardStaff("inventory.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [item] = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.tenantId, g.team.id)))
    .limit(1);
  if (!item) {
    return NextResponse.json({ error: "item_no_encontrado" }, { status: 404 });
  }

  const hoy = await hoyTenant(g.team.timezone);
  const lotes = await db
    .select({
      id: inventoryLots.id,
      lote: inventoryLots.lote,
      vence: inventoryLots.vence,
      cantidad: inventoryLots.cantidad,
    })
    .from(inventoryLots)
    .where(
      and(
        eq(inventoryLots.itemId, item.id),
        sql`${inventoryLots.cantidad} > 0`,
      ),
    )
    .orderBy(sql`${inventoryLots.vence} ASC NULLS LAST`);

  const disponibles = lotes.filter((l) => !l.vence || l.vence >= hoy);

  return NextResponse.json({ disponibles });
}
