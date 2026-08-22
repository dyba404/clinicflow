import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, teams, subscriptions } from "@clinicflow/db";
import { ipReq } from "@/lib/rate-limit";
import { adminGuard } from "@/lib/admin-guard";
import type { PlanCode, PlanStatus } from "@clinicflow/core";

export const dynamic = "force-dynamic";

const PLANES: PlanCode[] = ["free", "pro", "premium"];
const ESTADOS: PlanStatus[] = ["activo", "por_renovar", "suspendido", "cancelado"];

export async function PATCH(req: Request) {
  const guard = await adminGuard("suscripcion", ipReq(req));
  if (!guard.ok) return guard.response;

  let body: {
    tenantId?: string;
    plan?: string;
    estado?: string;
    vence?: string | null;
    monto?: number | string | null;
    nota?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tenantId = body.tenantId?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_requerido" }, { status: 400 });
  }

  const db = getDb();
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, tenantId)).limit(1);
  if (!team) {
    return NextResponse.json({ error: "tenant_no_encontrado" }, { status: 404 });
  }

  const valores: {
    tenantId: string;
    plan: PlanCode;
    estado: PlanStatus;
    vence: string | null;
    monto: string | null;
    nota: string | null;
    updatedAt: Date;
  } = {
    tenantId,
    plan: "free",
    estado: "activo",
    vence: null,
    monto: null,
    nota: null,
    updatedAt: new Date(),
  };

  const [actual] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);
  if (actual) {
    valores.plan = actual.plan;
    valores.estado = actual.estado;
    valores.vence = actual.vence;
    valores.monto = actual.monto;
    valores.nota = actual.nota;
  }

  if (body.plan !== undefined) {
    if (!PLANES.includes(body.plan as PlanCode)) {
      return NextResponse.json({ error: "plan_invalido" }, { status: 400 });
    }
    valores.plan = body.plan as PlanCode;
  }
  if (body.estado !== undefined) {
    if (!ESTADOS.includes(body.estado as PlanStatus)) {
      return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
    }
    valores.estado = body.estado as PlanStatus;
  }
  if (body.vence !== undefined) {
    if (body.vence === null || body.vence === "") {
      valores.vence = null;
    } else if (typeof body.vence === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.vence)) {
      valores.vence = body.vence;
    } else {
      return NextResponse.json({ error: "vence_invalida" }, { status: 400 });
    }
  }
  if (body.monto !== undefined) {
    if (body.monto === null || body.monto === "") {
      valores.monto = null;
    } else {
      const monto = Number(body.monto);
      if (!Number.isFinite(monto) || monto < 0) {
        return NextResponse.json({ error: "monto_invalido" }, { status: 400 });
      }
      valores.monto = monto.toFixed(2);
    }
  }
  if (body.nota !== undefined) {
    valores.nota = body.nota?.trim() || null;
  }

  await db
    .insert(subscriptions)
    .values(valores)
    .onConflictDoUpdate({
      target: subscriptions.tenantId,
      set: {
        plan: valores.plan,
        estado: valores.estado,
        vence: valores.vence,
        monto: valores.monto,
        nota: valores.nota,
        updatedAt: valores.updatedAt,
      },
    });

  return NextResponse.json({ ok: true, tenantId });
}
