import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, isNull, lt } from "drizzle-orm";
import { getDb, users, memberships, impersonationRequests } from "@clinicflow/db";
import {
  getPlatformSession,
  createSession,
  SESSION_COOKIE,
  ADMIN_RETURN_COOKIE,
  IMPERSONATED_MAX_AGE_SECONDS,
  sessionCookieBase,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { rateLimit, ipReq } from "@/lib/rate-limit";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limite = rateLimit(`impersonar:${ipReq(req)}`, 10);
  if (!limite.allowed) {
    return NextResponse.json({ error: "demasiadas_solicitudes" }, { status: 429 });
  }

  const { token } = await params;
  const db = getDb();

  await db.delete(impersonationRequests).where(lt(impersonationRequests.expiresAt, new Date()));

  const admin = await getPlatformSession();
  if (!admin) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });

  const [request] = await db
    .select()
    .from(impersonationRequests)
    .where(and(eq(impersonationRequests.token, token), isNull(impersonationRequests.usedAt)))
    .limit(1);
  if (!request || request.expiresAt < new Date() || request.requestedByUserId !== admin.userId) {
    return NextResponse.json({ error: "token_invalido" }, { status: 410 });
  }

  const [target] = await db.select().from(users).where(eq(users.id, request.targetUserId)).limit(1);
  if (!target || target.lockedAt) {
    return NextResponse.json({ error: "usuario_no_disponible" }, { status: 409 });
  }

  const [memb] = await db
    .select({ id: memberships.id, teamId: memberships.teamId })
    .from(memberships)
    .where(and(eq(memberships.userId, target.id), eq(memberships.teamId, request.tenantId), eq(memberships.active, true)))
    .limit(1);
  if (!memb) return NextResponse.json({ error: "usuario_sin_tenant" }, { status: 409 });

  const { token: nuevoToken, maxAgeSeconds } = await createSession({
    userId: target.id,
    tenantId: memb.teamId,
    membershipId: memb.id,
    impersonatedByUserId: admin.userId,
    maxAgeSeconds: IMPERSONATED_MAX_AGE_SECONDS,
    userAgent: req.headers.get("user-agent"),
    ip: ipReq(req),
  });

  await db
    .update(impersonationRequests)
    .set({ usedAt: new Date() })
    .where(eq(impersonationRequests.id, request.id));

  const store = await cookies();
  store.set(SESSION_COOKIE, nuevoToken, sessionCookieBase(maxAgeSeconds));
  store.set(ADMIN_RETURN_COOKIE, admin.sessionToken, sessionCookieBase(IMPERSONATED_MAX_AGE_SECONDS + 300));

  await logAudit({
    tenantId: memb.teamId,
    usuarioId: admin.userId,
    rol: null,
    accion: "soporte.impersonacion_inicio",
    entidad: "users",
    entidadId: target.id,
    payload: { via: "soporte_plataforma", adminEmail: admin.email, email: target.email },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3112";
  return NextResponse.redirect(`${base}/consola`);
}
