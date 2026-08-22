import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, users, memberships, passwordResets } from "@clinicflow/db";
import { randomHex, logAudit } from "@/lib/audit";
import { enviarEmailPasswordReset } from "@/lib/notify";
import { appBaseUrl, mailConfigurado } from "@/lib/mail";
import { ipReq } from "@/lib/rate-limit";
import { adminGuard, auditPayloadSoporte } from "@/lib/admin-guard";

export async function POST(req: Request) {
  const guard = await adminGuard("password-reset", ipReq(req));
  if (!guard.ok) return guard.response;

  let body: { userId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) return NextResponse.json({ error: "usuario_requerido" }, { status: 400 });

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "usuario_no_encontrado" }, { status: 404 });
  }
  if (user.lockedAt) {
    return NextResponse.json({ error: "usuario_bloqueado" }, { status: 409 });
  }

  const [memb] = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.active, true)))
    .limit(1);
  if (!memb) return NextResponse.json({ error: "usuario_sin_tenant" }, { status: 409 });

  if (!mailConfigurado()) {
    return NextResponse.json({ error: "email_no_configurado" }, { status: 422 });
  }

  const token = randomHex(24);
  await db.insert(passwordResets).values({
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 3600_000),
  });

  await enviarEmailPasswordReset({
    to: user.email,
    nombre: user.name.split(" ")[0] ?? user.name,
    resetUrl: `${appBaseUrl()}/recuperar/${token}`,
  });

  await logAudit({
    tenantId: memb.teamId,
    usuarioId: guard.admin.userId,
    rol: null,
    accion: "soporte.recuperacion_enviada",
    entidad: "users",
    entidadId: user.id,
    payload: auditPayloadSoporte(guard.admin.email, { email: user.email }),
  });

  return NextResponse.json({ ok: true });
}
