import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, users } from "@clinicflow/db";
import {
  getSession,
  getPlatformSession,
  verifyPassword,
  hashPassword,
  destroyOtherSessions,
} from "@/lib/auth";
import { rateLimit, ipReq } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limite = rateLimit(`cambiar_contrasena:${ipReq(req)}`, 5);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const staff = await getSession();
  const platform = staff ? null : await getPlatformSession();
  const sesion = staff ?? platform;
  if (!sesion) {
    return NextResponse.json({ error: "sin_sesion" }, { status: 401 });
  }

  let body: { actual?: string; nueva?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const actual = body.actual ?? "";
  const nueva = body.nueva ?? "";
  if (!actual || nueva.length < 8) {
    return NextResponse.json({ error: "contraseña_invalida" }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, sesion.userId)).limit(1);
  if (!user?.passwordHash || !(await verifyPassword(actual, user.passwordHash))) {
    return NextResponse.json({ error: "contraseña_actual_invalida" }, { status: 401 });
  }
  if (nueva === actual) {
    return NextResponse.json({ error: "contraseña_invalida" }, { status: 400 });
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(nueva), mustChangePassword: false })
    .where(eq(users.id, user.id));

  await destroyOtherSessions(user.id, sesion.sessionToken);

  return NextResponse.json({ ok: true });
}
