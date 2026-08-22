import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, memberships, users, commissionSettings } from "@clinicflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardStaff("commissions.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "comisiones");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const rows = await getDb()
    .select({
      membershipId: memberships.id,
      nombre: users.name,
      porcentaje: commissionSettings.porcentaje,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .leftJoin(commissionSettings, eq(commissionSettings.membershipId, memberships.id))
    .where(
      and(
        eq(memberships.teamId, g.team.id),
        eq(memberships.role, "doctor"),
        eq(memberships.active, true),
      ),
    );

  return NextResponse.json({
    doctores: rows.map((r) => ({
      membershipId: r.membershipId,
      nombre: r.nombre,
      porcentaje: r.porcentaje !== null ? Number(r.porcentaje) : 0,
    })),
  });
}

export async function PUT(req: Request) {
  const g = await guardStaff("commissions.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "comisiones");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  let body: { membershipId?: string; porcentaje?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!body.membershipId || typeof body.membershipId !== "string") {
    return NextResponse.json({ error: "membershipId_requerido" }, { status: 400 });
  }
  const porcentaje = Number(body.porcentaje);
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
    return NextResponse.json({ error: "porcentaje_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [doctor] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.id, body.membershipId),
        eq(memberships.teamId, g.team.id),
        eq(memberships.role, "doctor"),
      ),
    )
    .limit(1);
  if (!doctor) {
    return NextResponse.json({ error: "doctor_no_encontrado" }, { status: 404 });
  }

  await db
    .insert(commissionSettings)
    .values({
      membershipId: doctor.id,
      porcentaje: porcentaje.toFixed(2),
    })
    .onConflictDoUpdate({
      target: commissionSettings.membershipId,
      set: { porcentaje: porcentaje.toFixed(2), updatedAt: new Date() },
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "comision.configurar",
    entidad: "commission_settings",
    entidadId: doctor.id,
    payload: { porcentaje },
  });

  return NextResponse.json({ ok: true, membershipId: doctor.id, porcentaje });
}
