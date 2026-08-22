import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, users, memberships, sessions } from "@clinicflow/db";
import { logAudit } from "@/lib/audit";
import { ipReq } from "@/lib/rate-limit";
import { adminGuard, auditPayloadSoporte } from "@/lib/admin-guard";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminGuard("bloquear", ipReq(req));
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let body: { reason?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return NextResponse.json({ error: "usuario_no_encontrado" }, { status: 404 });
  if (user.isPlatformAdmin) {
    return NextResponse.json({ error: "no_aplica_a_admin" }, { status: 409 });
  }

  await db
    .update(users)
    .set({ lockedAt: new Date(), lockedReason: body.reason?.trim() || null })
    .where(eq(users.id, id));

  await db.delete(sessions).where(eq(sessions.userId, id));

  const tenants = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(eq(memberships.userId, id));
  for (const t of tenants) {
    await logAudit({
      tenantId: t.teamId,
      usuarioId: guard.admin.userId,
      rol: null,
      accion: "soporte.usuario_bloqueado",
      entidad: "users",
      entidadId: id,
      payload: auditPayloadSoporte(guard.admin.email, {
        email: user.email,
        reason: body.reason?.trim() || null,
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
