import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, cashClosures } from "@clinicflow/db";
import { guardStaff, guardError, getSession } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { logAuditSesion } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  if (g.membership.role !== "owner") {
    return NextResponse.json({ error: "solo_owner_puede_reabrir" }, { status: 403 });
  }
  const planCheck = await gatePlan(g.team.id, "caja");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);
  const session = await getSession();

  let body: { motivo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const motivo = body.motivo?.trim();
  if (!motivo || motivo.length < 3) {
    return NextResponse.json({ error: "motivo_requerido" }, { status: 400 });
  }

  const db = getDb();
  const [cierre] = await db
    .select()
    .from(cashClosures)
    .where(and(eq(cashClosures.id, id), eq(cashClosures.tenantId, g.team.id)))
    .limit(1);
  if (!cierre) {
    return NextResponse.json({ error: "cierre_no_encontrado" }, { status: 404 });
  }
  if (cierre.estado !== "cerrado") {
    return NextResponse.json({ error: "cierre_no_cerrado" }, { status: 409 });
  }

  const [row] = await db
    .update(cashClosures)
    .set({
      estado: "reabierto",
      reabiertoPor: g.user.id,
      reabiertoAt: new Date(),
      motivoReapertura: motivo,
    })
    .where(eq(cashClosures.id, id))
    .returning({ id: cashClosures.id, estado: cashClosures.estado });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "caja.reapertura",
    entidad: "caja",
    entidadId: id,
    payload: { fecha: cierre.fecha, motivo, por: session?.userId ?? g.user.id },
  });

  return NextResponse.json({ ok: true, cierre: row });
}
