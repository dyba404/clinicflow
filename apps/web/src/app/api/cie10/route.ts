import { NextResponse } from "next/server";
import { asc, ilike, or } from "drizzle-orm";
import { getDb, cie10 } from "@clinicflow/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ error: "q_requerido" }, { status: 400 });
  }
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;

  const rows = await getDb()
    .select({ codigo: cie10.codigo, descripcion: cie10.descripcion })
    .from(cie10)
    .where(or(ilike(cie10.descripcion, `%${q}%`), ilike(cie10.codigo, `${q}%`)))
    .orderBy(asc(cie10.codigo))
    .limit(limit);

  return NextResponse.json({ codigos: rows });
}
