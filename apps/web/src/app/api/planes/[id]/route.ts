import { NextResponse } from "next/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  getDb,
  treatmentPlans,
  treatmentPlanItems,
  treatmentPlanSessions,
  memberships,
  users,
} from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TRANSICIONES: Record<string, readonly string[]> = {
  draft: ["pending"],
  pending: ["active", "draft"],
  active: ["completed", "archived", "closed"],
  completed: [],
  archived: [],
  closed: [],
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [plan] = await db
    .select()
    .from(treatmentPlans)
    .leftJoin(memberships, eq(treatmentPlans.assignedDoctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(treatmentPlans.id, id), eq(treatmentPlans.tenantId, g.team.id)))
    .limit(1);
  if (!plan) return NextResponse.json({ error: "plan_no_encontrado" }, { status: 404 });

  const items = await db
    .select()
    .from(treatmentPlanItems)
    .where(and(eq(treatmentPlanItems.planId, id), eq(treatmentPlanItems.tenantId, g.team.id)))
    .orderBy(asc(treatmentPlanItems.secuencia));

  const sesiones =
    items.length > 0
      ? await db
          .select()
          .from(treatmentPlanSessions)
          .where(
            and(
              eq(treatmentPlanSessions.tenantId, g.team.id),
              inArray(treatmentPlanSessions.itemId, items.map((i) => i.id)),
            ),
          )
          .orderBy(asc(treatmentPlanSessions.sessionN))
      : [];
  const sesionesPorItem = new Map<string, typeof sesiones>();
  for (const s of sesiones) {
    const arr = sesionesPorItem.get(s.itemId) ?? [];
    arr.push(s);
    sesionesPorItem.set(s.itemId, arr);
  }

  const doctorNombre = plan.users?.name ?? null;
  const p = plan.treatment_plans;
  return NextResponse.json({
    plan: {
      ...p,
      doctorNombre,
      confirmedAt: p.confirmedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    },
    items: items.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      sesiones: (sesionesPorItem.get(i.id) ?? []).map((s) => ({
        ...s,
        realizadaAt: s.realizadaAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
    })),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { estado?: string; closureReason?: string | null; assignedDoctorId?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [plan] = await db
    .select({ id: treatmentPlans.id, estado: treatmentPlans.estado, patientId: treatmentPlans.patientId })
    .from(treatmentPlans)
    .where(and(eq(treatmentPlans.id, id), eq(treatmentPlans.tenantId, g.team.id)))
    .limit(1);
  if (!plan) return NextResponse.json({ error: "plan_no_encontrado" }, { status: 404 });

  const nuevo = body.estado;
  if (!nuevo || !TRANSICIONES[plan.estado]?.includes(nuevo)) {
    return NextResponse.json({ error: "transicion_invalida" }, { status: 400 });
  }
  if (nuevo === "pending" || nuevo === "active") {
    const [n] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(treatmentPlanItems)
      .where(eq(treatmentPlanItems.planId, id));
    if (!n || n.n === 0) return NextResponse.json({ error: "plan_sin_items" }, { status: 400 });
  }
  if (nuevo === "closed" && !(body.closureReason ?? "").trim()) {
    return NextResponse.json({ error: "motivo_cierre_requerido" }, { status: 400 });
  }

  const set: Record<string, unknown> = { estado: nuevo, updatedAt: new Date() };
  if (nuevo === "active") set.confirmedAt = new Date();
  if (nuevo === "closed") set.closureReason = (body.closureReason ?? "").trim();
  if (typeof body.assignedDoctorId === "string" || body.assignedDoctorId === null)
    set.assignedDoctorId = body.assignedDoctorId;

  await db.update(treatmentPlans).set(set).where(eq(treatmentPlans.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "plan_tratamiento.estado",
    entidad: "treatment_plans",
    entidadId: id,
    payload: { from: plan.estado, to: nuevo, patientId: plan.patientId },
  });

  return NextResponse.json({ ok: true, estado: nuevo });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [plan] = await db
    .select({ id: treatmentPlans.id, estado: treatmentPlans.estado })
    .from(treatmentPlans)
    .where(and(eq(treatmentPlans.id, id), eq(treatmentPlans.tenantId, g.team.id)))
    .limit(1);
  if (!plan) return NextResponse.json({ error: "plan_no_encontrado" }, { status: 404 });
  if (plan.estado !== "draft") return NextResponse.json({ error: "solo_borrador_eliminable" }, { status: 400 });

  await db.delete(treatmentPlans).where(eq(treatmentPlans.id, id));
  return NextResponse.json({ ok: true });
}
