import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, memberships } from "@clinicflow/db";
import { logAudit } from "@/lib/audit";
import { ipReq } from "@/lib/rate-limit";
import { adminGuard, auditPayloadSoporte } from "@/lib/admin-guard";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminGuard("membresias", ipReq(req));
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let body: { active?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active_requerido" }, { status: 400 });
  }

  const db = getDb();
  const [memb] = await db.select().from(memberships).where(eq(memberships.id, id)).limit(1);
  if (!memb) return NextResponse.json({ error: "membresia_no_encontrada" }, { status: 404 });

  if (memb.active === body.active) return NextResponse.json({ ok: true, sinCambios: true });

  await db.update(memberships).set({ active: body.active }).where(eq(memberships.id, id));

  await logAudit({
    tenantId: memb.teamId,
    usuarioId: guard.admin.userId,
    rol: null,
    accion: body.active ? "soporte.membresia_activada" : "soporte.membresia_desactivada",
    entidad: "memberships",
    entidadId: memb.id,
    payload: auditPayloadSoporte(guard.admin.email, { userId: memb.userId, active: body.active }),
  });

  return NextResponse.json({ ok: true, active: body.active });
}
