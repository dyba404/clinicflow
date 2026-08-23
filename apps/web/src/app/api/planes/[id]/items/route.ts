import { NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, services, treatmentPlans, treatmentPlanItems } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ITEM_TRANSICIONES: Record<string, readonly string[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { serviceId?: string; secuencia?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.serviceId) return NextResponse.json({ error: "servicio_requerido" }, { status: 400 });

  const db = getDb();
  const [plan] = await db
    .select({ id: treatmentPlans.id, estado: treatmentPlans.estado })
    .from(treatmentPlans)
    .where(and(eq(treatmentPlans.id, id), eq(treatmentPlans.tenantId, g.team.id)))
    .limit(1);
  if (!plan) return NextResponse.json({ error: "plan_no_encontrado" }, { status: 404 });
  if (!["draft", "pending"].includes(plan.estado)) {
    return NextResponse.json({ error: "plan_no_editable" }, { status: 400 });
  }

  const [svc] = await db
    .select({
      id: services.id,
      nombre: services.nombre,
      precio: services.precio,
      duracionMin: services.duracionMin,
    })
    .from(services)
    .where(and(eq(services.id, body.serviceId), eq(services.tenantId, g.team.id)))
    .limit(1);
  if (!svc) return NextResponse.json({ error: "servicio_no_encontrado" }, { status: 400 });

  const [maxSec] = await db
    .select({ n: sql<number>`coalesce(max(${treatmentPlanItems.secuencia}), 0)::int` })
    .from(treatmentPlanItems)
    .where(eq(treatmentPlanItems.planId, id));
  const secuencia =
    Number.isInteger(body.secuencia) && body.secuencia! > 0 ? body.secuencia! : (maxSec?.n ?? 0) + 1;

  const [item] = await db
    .insert(treatmentPlanItems)
    .values({
      tenantId: g.team.id,
      planId: id,
      serviceId: svc.id,
      secuencia,
      snapshotServicio: { nombre: svc.nombre, precio: svc.precio, duracionMin: svc.duracionMin },
    })
    .returning({ id: treatmentPlanItems.id, serviceId: treatmentPlanItems.serviceId, secuencia: treatmentPlanItems.secuencia });

  return NextResponse.json({ ok: true, item }, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { itemId?: string; estado?: string; secuencia?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.itemId) return NextResponse.json({ error: "item_requerido" }, { status: 400 });

  const db = getDb();
  const [item] = await db
    .select()
    .from(treatmentPlanItems)
    .leftJoin(treatmentPlans, eq(treatmentPlanItems.planId, treatmentPlans.id))
    .where(
      and(
        eq(treatmentPlanItems.id, body.itemId),
        eq(treatmentPlanItems.planId, id),
        eq(treatmentPlanItems.tenantId, g.team.id),
      ),
    )
    .limit(1);
  if (!item) return NextResponse.json({ error: "item_no_encontrado" }, { status: 404 });

  const set: Record<string, unknown> = {};
  if (body.estado) {
    if (!ITEM_TRANSICIONES[item.treatment_plan_items.estado]?.includes(body.estado)) {
      return NextResponse.json({ error: "transicion_item_invalida" }, { status: 400 });
    }
    set.estado = body.estado;
  }
  if (Number.isInteger(body.secuencia) && body.secuencia! > 0) set.secuencia = body.secuencia;
  if (Object.keys(set).length === 0) return NextResponse.json({ error: "nada_que_actualizar" }, { status: 400 });

  await db.update(treatmentPlanItems).set(set).where(eq(treatmentPlanItems.id, body.itemId));
  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const rows = await getDb()
    .select()
    .from(treatmentPlanItems)
    .where(and(eq(treatmentPlanItems.planId, id), eq(treatmentPlanItems.tenantId, g.team.id)))
    .orderBy(asc(treatmentPlanItems.secuencia));
  return NextResponse.json({ items: rows });
}
