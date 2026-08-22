import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, dispensations, inventoryItems, inventoryLots, patients } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardStaff();
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: dispensations.id,
      patientId: dispensations.patientId,
      itemId: dispensations.itemId,
      itemNombre: inventoryItems.nombre,
      lotId: dispensations.lotId,
      lote: inventoryLots.lote,
      cantidad: dispensations.cantidad,
      createdAt: dispensations.createdAt,
    })
    .from(dispensations)
    .innerJoin(inventoryItems, eq(dispensations.itemId, inventoryItems.id))
    .leftJoin(inventoryLots, eq(dispensations.lotId, inventoryLots.id))
    .where(and(eq(dispensations.tenantId, g.team.id), eq(dispensations.patientId, paciente.id)))
    .orderBy(desc(dispensations.createdAt));

  return NextResponse.json({ dispensaciones: rows });
}
