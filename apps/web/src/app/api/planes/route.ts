import { NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  getDb,
  patients,
  services,
  treatmentPlans,
  treatmentPlanItems,
  memberships,
  users,
} from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const qs = new URL(req.url).searchParams;
  const filtros = [];
  if (qs.get("patient")) filtros.push(eq(treatmentPlans.patientId, qs.get("patient")!));
  if (qs.get("estado"))
    filtros.push(eq(treatmentPlans.estado, qs.get("estado") as (typeof treatmentPlans.estado.enumValues)[number]));

  const rows = await db
    .select({
      id: treatmentPlans.id,
      planNumber: treatmentPlans.planNumber,
      titulo: treatmentPlans.titulo,
      estado: treatmentPlans.estado,
      patientId: treatmentPlans.patientId,
      patientNombre: patients.nombre,
      assignedDoctorId: treatmentPlans.assignedDoctorId,
      doctorNombre: users.name,
      createdAt: treatmentPlans.createdAt,
      updatedAt: treatmentPlans.updatedAt,
    })
    .from(treatmentPlans)
    .leftJoin(patients, eq(treatmentPlans.patientId, patients.id))
    .leftJoin(memberships, eq(treatmentPlans.assignedDoctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(treatmentPlans.tenantId, g.team.id), ...filtros))
    .orderBy(desc(treatmentPlans.createdAt))
    .limit(100);

  const conteos = rows.length
    ? await db
        .select({
          planId: treatmentPlanItems.planId,
          n: sql<number>`count(*)::int`,
        })
        .from(treatmentPlanItems)
        .where(
          inArray(
            treatmentPlanItems.planId,
            rows.map((r) => r.id),
          ),
        )
        .groupBy(treatmentPlanItems.planId)
    : [];
  const porPlan = new Map(conteos.map((c) => [c.planId, c.n]));

  return NextResponse.json({ planes: rows.map((r) => ({ ...r, itemsCount: porPlan.get(r.id) ?? 0 })) });
}

export async function POST(req: Request) {
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    patientId?: string;
    titulo?: string;
    assignedDoctorId?: string | null;
    items?: Array<{ serviceId?: string; secuencia?: number }>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const titulo = body.titulo?.trim();
  if (!titulo || titulo.length > 120) return NextResponse.json({ error: "titulo_invalido" }, { status: 400 });
  if (!body.patientId) return NextResponse.json({ error: "paciente_requerido" }, { status: 400 });

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, body.patientId), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) return NextResponse.json({ error: "items_requeridos" }, { status: 400 });

  const items = [];
  const snapshots = await db
    .select({
      id: services.id,
      nombre: services.nombre,
      precio: services.precio,
      duracionMin: services.duracionMin,
    })
    .from(services)
    .where(and(eq(services.tenantId, g.team.id), inArray(services.id, rawItems.map((i) => i.serviceId ?? ""))));
  const porServicio = new Map(snapshots.map((s) => [s.id, s]));
  for (const it of rawItems) {
    const svc = it.serviceId ? porServicio.get(it.serviceId) : undefined;
    if (!svc) return NextResponse.json({ error: "servicio_no_encontrado" }, { status: 400 });
    items.push({
      tenantId: g.team.id,
      serviceId: svc.id,
      secuencia: Number.isInteger(it.secuencia) && it.secuencia! > 0 ? it.secuencia! : items.length + 1,
      snapshotServicio: { nombre: svc.nombre, precio: svc.precio, duracionMin: svc.duracionMin },
    });
  }

  const anio = new Date().getFullYear();
  const [maximo] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(treatmentPlans)
    .where(
      and(
        eq(treatmentPlans.tenantId, g.team.id),
        sql`${treatmentPlans.planNumber} like ${`PLAN-${anio}-%`}`,
      ),
    );
  const planNumber = `PLAN-${anio}-${String((maximo?.n ?? 0) + 1).padStart(4, "0")}`;

  const [plan] = await db
    .insert(treatmentPlans)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      planNumber,
      titulo,
      estado: "draft",
      assignedDoctorId: body.assignedDoctorId ?? null,
      createdBy: g.user.id,
    })
    .returning({ id: treatmentPlans.id, planNumber: treatmentPlans.planNumber });

  await db.insert(treatmentPlanItems).values(items.map((i) => ({ ...i, planId: plan!.id })));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "plan_tratamiento.crear",
    entidad: "treatment_plans",
    entidadId: plan!.id,
    payload: { planNumber, items: items.length },
  });

  return NextResponse.json({ ok: true, plan }, { status: 201 });
}
