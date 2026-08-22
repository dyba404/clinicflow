import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, users, memberships } from "@clinicflow/db";
import { logAudit } from "@/lib/audit";
import { ipReq } from "@/lib/rate-limit";
import { adminGuard, auditPayloadSoporte } from "@/lib/admin-guard";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminGuard("desbloquear", ipReq(req));
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return NextResponse.json({ error: "usuario_no_encontrado" }, { status: 404 });

  await db
    .update(users)
    .set({ lockedAt: null, lockedReason: null })
    .where(eq(users.id, id));

  const tenants = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(eq(memberships.userId, id));
  for (const t of tenants) {
    await logAudit({
      tenantId: t.teamId,
      usuarioId: guard.admin.userId,
      rol: null,
      accion: "soporte.usuario_desbloqueado",
      entidad: "users",
      entidadId: id,
      payload: auditPayloadSoporte(guard.admin.email, { email: user.email }),
    });
  }

  return NextResponse.json({ ok: true });
}
