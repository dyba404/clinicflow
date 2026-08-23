import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, appointmentSeries } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { cancelarSerie } from "@/lib/series";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("appointments.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [serie] = await db
    .select({ id: appointmentSeries.id, estado: appointmentSeries.estado })
    .from(appointmentSeries)
    .where(and(eq(appointmentSeries.id, id), eq(appointmentSeries.tenantId, g.team.id)))
    .limit(1);
  if (!serie) return NextResponse.json({ error: "serie_no_encontrada" }, { status: 404 });
  if (serie.estado !== "activa") {
    return NextResponse.json({ error: `serie_${serie.estado}` }, { status: 409 });
  }

  const r = await cancelarSerie({ tenantId: g.team.id, serieId: id, userId: g.user.id });
  return NextResponse.json({ ok: true, canceladas: r.canceladas });
}
