import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb, sessions } from "@clinicflow/db";
import {
  getSession,
  destroySession,
  SESSION_COOKIE,
  ADMIN_RETURN_COOKIE,
  sessionCookieBase,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { rateLimit, ipReq } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limite = rateLimit(`fin-impersonacion:${ipReq(req)}`, 10);
  if (!limite.allowed) {
    return NextResponse.json({ error: "demasiadas_solicitudes" }, { status: 429 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });
  if (!session.impersonatedByUserId) {
    return NextResponse.json({ error: "no_esta_impersonando" }, { status: 409 });
  }

  const store = await cookies();
  const adminToken = store.get(ADMIN_RETURN_COOKIE)?.value ?? null;
  let adminSessionToken: string | null = null;

  if (adminToken) {
    const db = getDb();
    const [adminSes] = await db
      .select({ sessionToken: sessions.sessionToken, userId: sessions.userId })
      .from(sessions)
      .where(and(eq(sessions.sessionToken, adminToken), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (adminSes && adminSes.userId === session.impersonatedByUserId) {
      adminSessionToken = adminSes.sessionToken;
    }
  }

  await destroySession(session.sessionToken);

  await logAudit({
    tenantId: session.teamId,
    usuarioId: session.impersonatedByUserId,
    rol: null,
    accion: "soporte.impersonacion_fin",
    entidad: "users",
    entidadId: session.userId,
    payload: { via: "soporte_plataforma" },
  });

  if (adminSessionToken) {
    store.set(SESSION_COOKIE, adminSessionToken, sessionCookieBase());
  } else {
    store.delete(SESSION_COOKIE);
  }
  store.delete(ADMIN_RETURN_COOKIE);

  return NextResponse.json({ ok: true, adminRestored: Boolean(adminSessionToken) });
}
