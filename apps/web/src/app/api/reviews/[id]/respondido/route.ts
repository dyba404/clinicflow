import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, reviewRequests } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const g = await guardStaff("reminders.send");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [fila] = await db
    .select({ id: reviewRequests.id, respondido: reviewRequests.respondido })
    .from(reviewRequests)
    .where(and(eq(reviewRequests.tenantId, g.team.id), eq(reviewRequests.id, id)))
    .limit(1);
  if (!fila) return NextResponse.json({ error: "no_encontrada" }, { status: 404 });

  await db
    .update(reviewRequests)
    .set({ respondido: true, respondidoAt: new Date() })
    .where(eq(reviewRequests.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "resena.respondida",
    entidad: "review_requests",
    entidadId: id,
  });

  return NextResponse.json({ ok: true });
}
