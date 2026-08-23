import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb, treatmentPlanItems, treatmentPlanSessions } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SESION_TRANSICIONES: Record<string, readonly string[]> = {
  programada: ["realizada", "cancelada"],
  realizada: [],
  cancelada: [],
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { appointmentId?: string | null; notas?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const db = getDb();
  const [item] = await db
    .select({ id: treatmentPlanItems.id, estado: treatmentPlanItems.estado })
    .from(treatmentPlanItems)
    .where(
      and(
        eq(treatmentPlanItems.id, itemId),
        eq(treatmentPlanItems.planId, id),
        eq(treatmentPlanItems.tenantId, g.team.id),
      ),
    )
    .limit(1);
  if (!item) return NextResponse.json({ error: "item_no_encontrado" }, { status: 404 });

  const [maxN] = await db
    .select({ n: sql<number>`coalesce(max(${treatmentPlanSessions.sessionN}), 0)::int` })
    .from(treatmentPlanSessions)
    .where(eq(treatmentPlanSessions.itemId, itemId));

  const [sesion] = await db
    .insert(treatmentPlanSessions)
    .values({
      tenantId: g.team.id,
      itemId,
      sessionN: (maxN?.n ?? 0) + 1,
      appointmentId: body.appointmentId ?? null,
      notas: body.notas?.trim() || null,
    })
    .returning({ id: treatmentPlanSessions.id, sessionN: treatmentPlanSessions.sessionN });

  return NextResponse.json({ ok: true, sesion }, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { sesionId?: string; estado?: string; notas?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.sesionId || !body.estado) {
    return NextResponse.json({ error: "sesion_y_estado_requeridos" }, { status: 400 });
  }

  const db = getDb();
  const [sesion] = await db
    .select({
      id: treatmentPlanSessions.id,
      estado: treatmentPlanSessions.estado,
      planId: treatmentPlanItems.planId,
    })
    .from(treatmentPlanSessions)
    .innerJoin(treatmentPlanItems, eq(treatmentPlanSessions.itemId, treatmentPlanItems.id))
    .where(
      and(
        eq(treatmentPlanSessions.id, body.sesionId),
        eq(treatmentPlanSessions.itemId, itemId),
        eq(treatmentPlanSessions.tenantId, g.team.id),
      ),
    )
    .limit(1);
  if (!sesion || sesion.planId !== id) {
    return NextResponse.json({ error: "sesion_no_encontrada" }, { status: 404 });
  }

  if (!SESION_TRANSICIONES[sesion.estado]?.includes(body.estado)) {
    return NextResponse.json({ error: "transicion_sesion_invalida" }, { status: 400 });
  }

  const set: Record<string, unknown> = { estado: body.estado };
  if (body.estado === "realizada") set.realizadaAt = new Date();
  if (typeof body.notas === "string") set.notas = body.notas.trim() || null;

  await db.update(treatmentPlanSessions).set(set).where(eq(treatmentPlanSessions.id, body.sesionId));
  return NextResponse.json({ ok: true });
}
