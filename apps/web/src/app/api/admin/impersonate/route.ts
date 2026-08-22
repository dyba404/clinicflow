import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, users, memberships, impersonationRequests } from "@clinicflow/db";
import { randomHex, logAudit } from "@/lib/audit";
import { ipReq } from "@/lib/rate-limit";
import { adminGuard, auditPayloadSoporte } from "@/lib/admin-guard";

const TTL_MINUTOS = 15;

export async function POST(req: Request) {
  const guard = await adminGuard("impersonar", ipReq(req));
  if (!guard.ok) return guard.response;

  let body: { userId?: string; tenantId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) return NextResponse.json({ error: "usuario_requerido" }, { status: 400 });

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ error: "usuario_no_encontrado" }, { status: 404 });
  if (user.isPlatformAdmin) {
    return NextResponse.json({ error: "no_aplica_a_admin" }, { status: 409 });
  }
  if (user.lockedAt) {
    return NextResponse.json({ error: "usuario_bloqueado" }, { status: 409 });
  }

  const membresias = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.active, true)));
  if (membresias.length === 0) {
    return NextResponse.json({ error: "usuario_sin_tenant" }, { status: 409 });
  }

  let tenantId = membresias[0]!.teamId;
  if (body.tenantId) {
    const valido = membresias.find((m) => m.teamId === body.tenantId);
    if (!valido) return NextResponse.json({ error: "tenant_invalido" }, { status: 400 });
    tenantId = valido.teamId;
  }

  const token = randomHex(24);
  await db.insert(impersonationRequests).values({
    token,
    targetUserId: userId,
    tenantId,
    requestedByUserId: guard.admin.userId,
    expiresAt: new Date(Date.now() + TTL_MINUTOS * 60_000),
  });

  await logAudit({
    tenantId,
    usuarioId: guard.admin.userId,
    rol: null,
    accion: "soporte.impersonacion_solicitada",
    entidad: "users",
    entidadId: userId,
    payload: auditPayloadSoporte(guard.admin.email, { email: user.email }),
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3112";
  return NextResponse.json({ ok: true, url: `${base}/api/admin/impersonar/${token}` });
}
